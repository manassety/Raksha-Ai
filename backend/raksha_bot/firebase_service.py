from firebase_admin import firestore

class RakshaFirebaseService:
    def __init__(self):
        self.db = firestore.client()

    def save_chat_message(self, user_id, message_data):
        try:
            # Save to a collection like 'chats/{user_id}/messages'
            chat_ref = self.db.collection('users').document(user_id).collection('ai_chats')
            chat_ref.add({
                **message_data,
                'timestamp': firestore.SERVER_TIMESTAMP
            })
            return True
        except Exception as e:
            print(f"[Firebase Service] Error saving message: {e}")
            return False

    def get_chat_history(self, user_id, limit=20):
        try:
            messages = self.db.collection('users').document(user_id).collection('ai_chats')\
                .order_by('timestamp', direction=firestore.Query.DESCENDING)\
                .limit(limit).stream()
            return [m.to_dict() for m in messages]
        except:
            return []
