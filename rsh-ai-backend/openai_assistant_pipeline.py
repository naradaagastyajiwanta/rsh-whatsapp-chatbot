import os
import json
import requests
import logging
from typing import Optional, Dict
from assistant_thread_manager import get_thread_id_for_nomor, set_thread_id_for_nomor

logger = logging.getLogger(__name__)

OPENAI_API_URL = "https://api.openai.com/v1"

def get_headers() -> Dict[str, str]:
    """Get headers for OpenAI API request with fresh API key."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.error("[AssistantAPI] OPENAI_API_KEY tidak ditemukan di environment variables")
        raise ValueError("OPENAI_API_KEY tidak ditemukan")
    
    logger.info(f"[AssistantAPI] API Key length: {len(api_key)} karakter")
    return {
        "Authorization": f"Bearer {api_key}",
        "OpenAI-Beta": "assistants=v2",
        "Content-Type": "application/json"
    }

def get_assistant_id() -> str:
    """Get Assistant ID from environment variable or use default."""
    assistant_id = os.getenv("OPENAI_ASSISTANT_ID", "asst_LYSlpGrksHr9KLLjGxKvoRO2")
    logger.info(f"[AssistantAPI] Using Assistant ID: {assistant_id}")
    return assistant_id

def ensure_thread_for_nomor(nomor: str) -> Optional[str]:
    try:
        thread_id = get_thread_id_for_nomor(nomor)
        if thread_id:
            logger.info(f"[AssistantAPI] Thread sudah ada untuk nomor {nomor}: {thread_id}")
            return thread_id
        
        # Create new thread
        logger.info(f"[AssistantAPI] Membuat thread baru untuk nomor {nomor}")
        headers = get_headers()
        resp = requests.post(f"{OPENAI_API_URL}/threads", headers=headers, json={})
        resp_json = resp.json()
        logger.info(f"[AssistantAPI] Response create thread: {resp.status_code} {resp_json}")
        
        if resp.status_code == 200:
            thread_id = resp_json.get("id")
            if not thread_id:
                logger.error("[AssistantAPI] Thread ID tidak ditemukan di response")
                return None
            set_thread_id_for_nomor(nomor, thread_id)
            return thread_id
            
        logger.error(f"[AssistantAPI] Gagal membuat thread: {resp_json}")
        return None
    except Exception as e:
        logger.error(f"[AssistantAPI] Error saat membuat/mengambil thread: {str(e)}")
        return None

def send_message_and_get_response(nomor: str, message: str) -> Optional[str]:
    try:
        thread_id = ensure_thread_for_nomor(nomor)
        if not thread_id:
            logger.error(f"[AssistantAPI] Tidak dapat membuat/mengambil thread untuk nomor {nomor}")
            return "Gagal membuat/mengambil thread OpenAI Assistant."
        
        # Get fresh headers for each request
        headers = get_headers()
        assistant_id = get_assistant_id()
        
        # Send message
        logger.info(f"[AssistantAPI] Mengirim pesan ke thread {thread_id} untuk nomor {nomor}: {message}")
        msg_resp = requests.post(
            f"{OPENAI_API_URL}/threads/{thread_id}/messages",
            headers=headers,
            json={"role": "user", "content": message}
        )
        msg_json = msg_resp.json()
        logger.info(f"[AssistantAPI] Response kirim pesan: {msg_resp.status_code} {msg_json}")
        if msg_resp.status_code != 200:
            logger.error(f"[AssistantAPI] Gagal mengirim pesan: {msg_json}")
            return f"Gagal mengirim pesan ke Assistant: {msg_json}"
        
        # Run assistant with streaming
        logger.info(f"[AssistantAPI] Menjalankan Assistant {assistant_id} untuk thread {thread_id} dengan streaming")
        run_resp = requests.post(
            f"{OPENAI_API_URL}/threads/{thread_id}/runs",
            headers=headers,
            json={
                "assistant_id": assistant_id,
                "stream": True
            },
            stream=True
        )
        
        if run_resp.status_code != 200:
            logger.error(f"[AssistantAPI] Gagal memulai run dengan streaming: {run_resp.text}")
            return f"Gagal memulai Assistant run dengan streaming"
        
        run_id = None
        final_message = None
        
        # Process streaming events
        for line in run_resp.iter_lines():
            if not line:
                continue
                
            try:
                event_data = line.decode('utf-8')
                if event_data == '[DONE]':
                    break
                    
                if event_data.startswith('data: '):
                    event_json = json.loads(event_data[6:])
                    event_type = event_json.get('type')
                    
                    if event_type == 'thread.created':
                        logger.info(f"[AssistantAPI] Thread created: {event_json}")
                    elif event_type == 'thread.run.created':
                        run_id = event_json['data']['id']
                        logger.info(f"[AssistantAPI] Run created: {run_id}")
                    elif event_type == 'thread.message.created':
                        logger.info(f"[AssistantAPI] Message created: {event_json}")
                    elif event_type == 'thread.message.in_progress':
                        logger.info(f"[AssistantAPI] Message in progress: {event_json}")
                    elif event_type == 'thread.message.delta':
                        # Process message delta/chunk
                        delta = event_json['data']['delta']
                        if delta.get('content'):
                            content = delta['content'][0]
                            if content['type'] == 'text':
                                chunk = content['text']['value']
                                logger.info(f"[AssistantAPI] Message chunk: {chunk}")
                    elif event_type == 'thread.message.completed':
                        message_data = event_json['data']
                        if message_data['role'] == 'assistant':
                            content = message_data['content'][0]
                            if content['type'] == 'text':
                                final_message = content['text']['value']
                                logger.info(f"[AssistantAPI] Final message: {final_message[:100]}...")
                    
            except json.JSONDecodeError as e:
                logger.warning(f"[AssistantAPI] Failed to parse event: {event_data}, error: {str(e)}")
                continue
        
        if final_message:
            return final_message
        
        # Fallback: get latest messages if streaming didn't work
        logger.warning("[AssistantAPI] Streaming tidak berhasil mendapatkan pesan akhir, mencoba cara biasa")
        msgs_resp = requests.get(
            f"{OPENAI_API_URL}/threads/{thread_id}/messages",
            headers=headers
        )
        msgs_json = msgs_resp.json()
        
        if msgs_resp.status_code != 200:
            logger.error(f"[AssistantAPI] Gagal mengambil pesan: {msgs_json}")
            return f"Gagal mengambil pesan Assistant"
        
        messages = msgs_json.get("data", [])
        if not messages:
            return "Tidak ada pesan dari Assistant"
        
        # Get latest assistant message
        for msg in messages:
            if msg.get("role") == "assistant":
                content = msg.get("content", [])
                if content and isinstance(content, list):
                    text_content = content[0].get("text", {}).get("value")
                    if text_content:
                        return text_content
        
        return "Assistant tidak memberikan respons yang valid"
        
    except Exception as e:
        logger.error(f"[AssistantAPI] Error saat memproses pesan: {str(e)}")
        return f"Terjadi error saat memproses pesan: {str(e)}"
