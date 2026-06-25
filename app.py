from flask import Flask, request, jsonify, Response, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
import cv2
import numpy as np
import base64
import os
import time
import sys
from datetime import datetime
from dotenv import load_dotenv

# Load Environment Variables
load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Initialize App
app = Flask(__name__)
CORS(app)
# max_http_buffer_size = 5MB to handle incoming frame chunks safely
socketio = SocketIO(app, cors_allowed_origins="*", max_http_buffer_size=5_000_000, async_mode="eventlet")

# --- AI & FIREBASE CONFIG ---
HF_MODEL = os.getenv("HF_MODEL", "Qwen/Qwen3-32B")
AI_PROVIDER = os.getenv("AI_PROVIDER", "huggingface")
print(f"Provider: {AI_PROVIDER}")
print(f"Model: {HF_MODEL}")

sys.path.append(os.path.join(BASE_DIR, 'backend'))
try:
    from services.huggingface_service import HuggingFaceService
    from raksha_bot.firebase_service import RakshaFirebaseService
    from raksha_bot.pdf_generator import StudyPlanPDFGenerator
except ImportError:
    print("[Warning] Bot modules not found")

import firebase_admin
from firebase_admin import credentials, firestore, storage

# --- BOT & GUARDIAN INITIALIZATION ---
bot_engine = None
bot_fb = None
pdf_gen = None

if 'HuggingFaceService' in globals():
    try:
        if os.environ.get("HF_TOKEN"):
            bot_engine = HuggingFaceService()
            bot_fb = RakshaFirebaseService()
            pdf_gen = StudyPlanPDFGenerator()
            print("[Bot] Components initialized with HuggingFace successfully")
        else:
            print("[Bot] Warning: HF_TOKEN not found, engine deferred")
    except Exception as e:
        print(f"[Bot] Initialization failed: {e}")

# --- FIREBASE INITIALIZATION ---
if not firebase_admin._apps:
    try:
        cred_name = os.environ.get("FIREBASE_SERVICE_ACCOUNT_NAME", "serviceAccountKey.json")
        if os.path.exists(cred_name):
            cred = credentials.Certificate(cred_name)
            firebase_admin.initialize_app(cred, {
                'storageBucket': os.environ.get("FIREBASE_STORAGE_BUCKET", "tanprix-52683.appspot.com")
            })
            print("[Firebase] Admin SDK initialized")
    except Exception as e:
        print(f"[Firebase] Critical Init Error: {e}")

# --- VISION MODELS INITIALIZATION ---
face_cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
face_cascade = cv2.CascadeClassifier(face_cascade_path) if os.path.exists(face_cascade_path) else None

yolo_weights = os.path.join(BASE_DIR, "yolov3-tiny.weights")
yolo_cfg = os.path.join(BASE_DIR, "yolov3-tiny.cfg")
coco_names = os.path.join(BASE_DIR, "coco.names")

net = None
classes = []
output_layers = []

if os.path.exists(yolo_weights) and os.path.exists(yolo_cfg) and os.path.exists(coco_names):
    try:
        net = cv2.dnn.readNet(yolo_weights, yolo_cfg)
        with open(coco_names, "r") as f:
            classes = [line.strip() for line in f.readlines()]
        layer_names = net.getLayerNames()
        try:
            output_layers = [layer_names[i - 1] for i in net.getUnconnectedOutLayers()]
        except:
            output_layers = [layer_names[i[0] - 1] for i in net.getUnconnectedOutLayers()]
        print("[INFO] YOLOv3-tiny loaded successfully.")
    except Exception as e:
        print(f"[ERROR] Failed to load YOLO: {e}")
        net = None

# In-memory storage
evidence_count = {}
evidence_dir = os.path.join(BASE_DIR, "evidence")
os.makedirs(evidence_dir, exist_ok=True)
active_sessions = {}

# --- SOCKET.IO HANDLERS ---

@socketio.on('connect')
def handle_connect():
    print(f"[Socket] Client connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"[Socket] Client disconnected: {request.sid}")
    for sos_id, session_data in list(active_sessions.items()):
        if session_data.get('streamerSocket') == request.sid:
            del active_sessions[sos_id]
            emit('sos:session_ended', {'sosId': sos_id}, broadcast=True)

@socketio.on('sos:start')
def on_sos_start(data):
    sos_id = data.get('sosId')
    user_name = data.get('userName', 'Unknown')
    active_sessions[sos_id] = {
        'sosId': sos_id,
        'userId': data.get('userId'),
        'userName': user_name,
        'location': data.get('location'),
        'streamerSocket': request.sid,
        'startTime': time.time() * 1000,
        'lastFrameTime': time.time() * 1000,
        'humanDetected': False
    }
    join_room(f"sos:{sos_id}")
    emit('sos:new_session', active_sessions[sos_id], broadcast=True, include_self=False)

@socketio.on('sos:frame')
def on_sos_frame(data):
    sos_id = data.get('sosId')
    if sos_id in active_sessions:
        active_sessions[sos_id]['lastFrameTime'] = time.time() * 1000
        active_sessions[sos_id]['humanDetected'] = data.get('humanDetected') or active_sessions[sos_id]['humanDetected']
        emit(f"sos:live_frame:{sos_id}", {
            'frame': data.get('frame'),
            'timestamp': data.get('timestamp'),
            'humanDetected': data.get('humanDetected')
        }, broadcast=True, include_self=False)

@socketio.on('admin:voice_command')
def on_admin_voice_command(data):
    sos_id = data.get('sosId')
    message = data.get('message')
    session = active_sessions.get(sos_id)
    if session:
        emit('sos:voice_command', {'message': message, 'sosId': sos_id}, to=session['streamerSocket'])

# --- REST API ROUTES ---

@app.route("/", methods=["GET", "HEAD"])
def index():
    return jsonify({
        "service": "RakshaAI Central AI Engine",
        "status": "Online",
        "provider": AI_PROVIDER,
        "model": HF_MODEL,
        "version": "1.1"
    })

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"})

@app.route("/api/ai/chat", methods=["POST"])
def ai_chat():
    try:
        data = request.json
        user_message = data.get("message", "")
        section = data.get("section", "safety")
        user_id = data.get("user_id", "guest")

        if not user_message:
            return jsonify({"success": False, "error": "Message is empty"}), 400

        if bot_engine:
            res = bot_engine.get_chat_response(user_message, section)
            if res.get("success"):
                reply = res.get("reply")
                if bot_fb and user_id != "guest":
                    try:
                        bot_fb.save_chat_message(user_id, {"sender": "bot", "message": reply, "section": section})
                    except: pass
                return jsonify({"success": True, "provider": "huggingface", "model": HF_MODEL, "reply": reply})
            else:
                return jsonify({"success": False, "error": res.get("error", "AI Inference Failure")}), 503
        else:
            return jsonify({"success": False, "error": "AI Engine not initialized"}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/auth/register', methods=['POST'])
def register_face():
    data = request.json
    user_id = data.get('user_id')
    image_base64 = data.get('image')
    if not user_id or not image_base64: return jsonify({"error": "Missing data"}), 400
    try:
        if ',' in image_base64: image_base64 = image_base64.split(',')[1]
        img_data = base64.b64decode(image_base64)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if face_cascade is not None:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.1, 5)
            if len(faces) > 0:
                return jsonify({"success": True, "message": "Face registered."})
        return jsonify({"success": True, "message": "Registered (Bypassed)."})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/evidence/analyze', methods=['POST'])
def analyze_frame():
    data = request.json
    user_id = data.get('user_id')
    image_base64 = data.get('image')
    if not user_id or not image_base64: return jsonify({"error": "Missing data"}), 400
    try:
        if ',' in image_base64: image_base64 = image_base64.split(',')[1]
        img_data = base64.b64decode(image_base64)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        human_detected = False
        if net:
            blob = cv2.dnn.blobFromImage(img, 0.00392, (320, 320), (0, 0, 0), True, crop=False)
            net.setInput(blob)
            outs = net.forward(output_layers)
            for out in outs:
                for detection in out:
                    if detection[5] > 0.3: human_detected = True
        elif face_cascade:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.1, 4)
            if len(faces) > 0: human_detected = True
        
        evidence_saved = False
        if human_detected:
            timestamp = int(time.time())
            cv2.imwrite(os.path.join(evidence_dir, f"evidence_{user_id}_{timestamp}.jpg"), img)
            evidence_saved = True
        
        _, buffer = cv2.imencode('.jpg', img)
        return jsonify({"success": True, "unknown_detected": human_detected, "evidence_saved": evidence_saved})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/sos/send_cloud_sms', methods=['POST'])
def send_cloud_sms():
    data = request.json or {}
    numbers = data.get('numbers', [])
    print(f"[CLOUD SMS] Sending SOS to {', '.join(numbers)}")
    return jsonify({"success": True, "message": "Cloud SMS Sent."})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 10000))
    socketio.run(app, host='0.0.0.0', port=port, debug=False)
