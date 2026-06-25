import requests
import os
import time

class HuggingFaceService:
    def __init__(self):
        self.hf_token = os.getenv("HF_TOKEN")
        self.model = os.getenv("HF_MODEL", "Qwen/Qwen3-32B")
        self.api_url = "https://router.huggingface.co/v1/chat/completions"
        
        print(f"[HF Service] Initialized. Model: {self.model}")
        if not self.hf_token:
            print("[HF Service] WARNING: HF_TOKEN is not set.")

    def get_system_instruction(self, section):
        base = (
            "You are Raksha AI Bot, a safety, education, and tech assistant inside the Raksha AI women safety app. "
            "Keep answers practical, simple, India-focused, and helpful. "
            "For legal help, provide general guidance only and advise contacting police/lawyer for urgent cases. "
            "For exams, never invent dates. If data is missing, say it is not clearly mentioned."
        )
        
        section_rules = {
            "safety": (
                "SECTION: SAFETY. You must only answer about: women safety, SOS, emergency steps, police help, "
                "complaint filing, Raksha AI app usage, and cyber safety. "
                "If the user asks an unrelated question, politely say: 'This section only supports safety related help. Please switch section.'"
            ),
            "education": (
                "SECTION: EDUCATION. You must only answer about: competitive exams, government exams, study plans, "
                "syllabus, preparation strategy, latest live forms, and exam doubts. "
                "If the user asks an unrelated question, politely say: 'This section only supports education and exam help. Please switch section.'"
            ),
            "tech": (
                "SECTION: TECH. You must only answer about: app usage, phone safety, cyber security, technical doubts, "
                "basic coding help, and Raksha AI technical features. "
                "If the user asks an unrelated question, politely say: 'This section only supports technical help. Please switch section.'"
            ),
            "legal": (
                "SECTION: LEGAL HELP. You are guiding the user on their rights. "
                "If mode is 'Police': Give step-by-step emergency action, FIR/complaint guidance, helpline suggestions, and nearest police station guidance. "
                "If mode is 'Lawyer': Explain relevant sections, rights, documentation, and useful proof. "
                "ADD DISCLAIMER: 'This is general legal guidance. For serious cases, contact police or a qualified lawyer.'"
            )
        }
        
        return f"{base} {section_rules.get(section, '')}"

    def get_chat_response(self, query, section, context=None):
        start_time = time.time()
        system_msg = self.get_system_instruction(section)
        
        headers = {
            "Authorization": f"Bearer {self.hf_token}",
            "Content-Type": "application/json"
        }
        
        messages = [{"role": "system", "content": system_msg}]
        if context:
            messages.append({"role": "system", "content": f"Context: {context}"})
        messages.append({"role": "user", "content": query})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 1200
        }

        try:
            response = requests.post(self.api_url, headers=headers, json=payload, timeout=60)
            inference_time = round(time.time() - start_time, 2)
            
            if response.status_code == 200:
                data = response.json()
                reply = data['choices'][0]['message']['content']
                print(f"[HF Service] Success. Inference time: {inference_time}s")
                return {
                    "success": True,
                    "provider": "huggingface",
                    "model": self.model,
                    "reply": reply,
                    "inference_time": inference_time
                }
            else:
                error_data = response.text
                print(f"[HF Service] Error {response.status_code}: {error_data}")
                return {
                    "success": False,
                    "provider": "huggingface",
                    "error": f"HF Error {response.status_code}",
                    "details": error_data
                }
        except Exception as e:
            print(f"[HF Service] Exception: {str(e)}")
            return {
                "success": False,
                "provider": "huggingface",
                "error": str(e)
            }
            
    def generate_study_plan(self, exam_data):
        prompt = (
            f"Generate a full study plan for the exam: {exam_data.get('examName')}. "
            f"Exam Date: {exam_data.get('examDate')}. Syllabus: {exam_data.get('syllabus')}. "
            "The plan MUST include: Exam overview, Syllabus breakdown, Roadmap till exam date, "
            "Daily targets, Weekly targets, Revision plan, Mock test plan, Resources, and a Final 7-day strategy. "
            "Format the response clearly using Markdown."
        )
        result = self.get_chat_response(prompt, "education")
        return result.get("reply") if result.get("success") else "Error generating study plan."
