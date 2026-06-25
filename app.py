import math
from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import os
from dotenv import load_dotenv
load_dotenv() # Load variables from .env if present
import sys
import time
from datetime import datetime

print("Python Version:", sys.version)

HF_MODEL = os.getenv("HF_MODEL", "Qwen/Qwen3-32B")
AI_PROVIDER = os.getenv("AI_PROVIDER", "huggingface")
print(f"Provider: {AI_PROVIDER}")
print(f"Model: {HF_MODEL}")

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
try:
    from services.huggingface_service import HuggingFaceService
    from raksha_bot.firebase_service import RakshaFirebaseService
    from raksha_bot.pdf_generator import StudyPlanPDFGenerator
except ImportError:
    print("[Warning] Bot modules not found")

import firebase_admin
from firebase_admin import credentials, firestore, storage

app = Flask(__name__)
app.config['SECRET_KEY'] = 'raksha_secret_key'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

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

db = firestore.client() if firebase_admin._apps else None

# --- AI CHAT ROUTES ---

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
                
                # Save to Firebase if successful
                if bot_fb and user_id != "guest":
                    try:
                        bot_fb.save_chat_message(user_id, {"sender": "bot", "message": reply, "section": section})
                    except: pass

                print(f"AI Chat - Provider: huggingface, Model: {HF_MODEL}, Time: {res.get('inference_time')}s")
                return jsonify({
                    "success": True,
                    "provider": "huggingface",
                    "model": HF_MODEL,
                    "reply": reply
                })
            else:
                print(f"AI Chat Error - Provider: huggingface, Model: {HF_MODEL}, Error: {res.get('error')}")
                return jsonify({
                    "success": False,
                    "provider": "huggingface",
                    "error": res.get("error", "AI Inference Failure"),
                    "details": res.get("details", "")
                }), 503
        else:
            return jsonify({
                "success": False,
                "error": "AI Engine not initialized"
            }), 500

    except Exception as e:
        app.logger.exception("AI Chat Logic Failure")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route("/api/ai/test", methods=["GET"])
def ai_test_route():
    try:
        if bot_engine:
            res = bot_engine.get_chat_response("Hello, are you active?", "safety")
            if res.get("success"):
                return jsonify({
                    "success": True,
                    "provider": "huggingface",
                    "model": HF_MODEL,
                    "reply": res.get("reply")
                })
            else:
                return jsonify({
                    "success": False,
                    "provider": "huggingface",
                    "error": res.get("error")
                }), 503
        
        return jsonify({"success": False, "error": "Bot engine not ready"}), 500

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route("/api/ai/provider", methods=["GET"])
def ai_provider_route():
    return jsonify({
        "provider": "huggingface",
        "model": HF_MODEL,
        "status": "connected" if bot_engine else "disconnected"
    })

@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "message": "Raksha AI Bot backend running",
        "status": "ok",
        "provider": "huggingface"
    })

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 10000))
    socketio.run(app, host='0.0.0.0', port=port, debug=False)
