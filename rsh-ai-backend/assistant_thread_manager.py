import os
import json
import time
import requests
import logging
from typing import Optional, Dict, Tuple

logger = logging.getLogger(__name__)

THREADS_FILE = os.path.join(os.path.dirname(__file__), "assistant_threads.json")

# Load or initialize mapping nomor WhatsApp -> thread_id
if os.path.exists(THREADS_FILE):
    with open(THREADS_FILE, "r", encoding="utf-8") as f:
        nomor_to_thread = json.load(f)
else:
    nomor_to_thread = {}

# Tambahkan dictionary untuk melacak thread yang sedang digunakan
active_threads = {}

def save_threads():
    with open(THREADS_FILE, "w", encoding="utf-8") as f:
        json.dump(nomor_to_thread, f, ensure_ascii=False, indent=2)

def get_thread_id_for_nomor(nomor: str) -> Optional[str]:
    return nomor_to_thread.get(nomor)

def get_all_threads() -> Dict[str, str]:
    """Return all available threads mapping (nomor -> thread_id)."""
    return nomor_to_thread

def set_thread_id_for_nomor(nomor: str, thread_id: str):
    nomor_to_thread[nomor] = thread_id
    save_threads()

def create_new_thread(headers: Dict[str, str]) -> Optional[str]:
    """Create a new thread using OpenAI API."""
    try:
        OPENAI_API_URL = "https://api.openai.com/v1"
        resp = requests.post(
            f"{OPENAI_API_URL}/threads", 
            headers=headers, 
            json={},
            timeout=30
        )
        
        if resp.status_code != 200:
            logger.error(f"[ThreadManager] Failed to create new thread: {resp.text}")
            return None
            
        thread_data = resp.json()
        thread_id = thread_data.get("id")
        
        if not thread_id:
            logger.error(f"[ThreadManager] Thread ID not found in response: {thread_data}")
            return None
            
        logger.info(f"[ThreadManager] Created new thread with ID: {thread_id}")
        return thread_id
    except Exception as e:
        logger.error(f"[ThreadManager] Error creating new thread: {str(e)}")
        return None

def reset_thread_for_nomor(nomor: str, headers: Dict[str, str]) -> Tuple[bool, Optional[str]]:
    """Reset thread for a specific user by creating a new one."""
    try:
        # Create a new thread
        new_thread_id = create_new_thread(headers)
        
        if not new_thread_id:
            logger.error(f"[ThreadManager] Failed to create new thread for {nomor}")
            return False, None
            
        # Update the mapping
        old_thread_id = nomor_to_thread.get(nomor)
        nomor_to_thread[nomor] = new_thread_id
        save_threads()
        
        logger.info(f"[ThreadManager] Reset thread for {nomor}: {old_thread_id} -> {new_thread_id}")
        return True, new_thread_id
    except Exception as e:
        logger.error(f"[ThreadManager] Error resetting thread for {nomor}: {str(e)}")
        return False, None

# Utility to clear all (for admin/testing only)
def clear_all_threads():
    global nomor_to_thread
    nomor_to_thread = {}
    if os.path.exists(THREADS_FILE):
        os.remove(THREADS_FILE)
    save_threads()
    return True
