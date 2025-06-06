import os
import json
import time
import requests
import logging
import os
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
    """Get thread ID for a given WhatsApp number with format handling.
    
    Args:
        nomor: WhatsApp number, with or without @s.whatsapp.net suffix
        
    Returns:
        Thread ID if found, None otherwise
    """
    # Normalize input
    cleaned_nomor = nomor.strip()
    
    # Try direct lookup first
    thread_id = nomor_to_thread.get(cleaned_nomor)
    if thread_id:
        logger.info(f"Found thread ID {thread_id} for exact match: {cleaned_nomor}")
        return thread_id
    
    # Try with and without @s.whatsapp.net suffix
    if '@s.whatsapp.net' in cleaned_nomor:
        # Try without suffix
        base_nomor = cleaned_nomor.split('@')[0]
        thread_id = nomor_to_thread.get(base_nomor)
        if thread_id:
            logger.info(f"Found thread ID {thread_id} for base number: {base_nomor}")
            return thread_id
    else:
        # Try with suffix
        suffixed_nomor = f"{cleaned_nomor}@s.whatsapp.net"
        thread_id = nomor_to_thread.get(suffixed_nomor)
        if thread_id:
            logger.info(f"Found thread ID {thread_id} for suffixed number: {suffixed_nomor}")
            return thread_id
    
    # Try with analytics_ prefix
    if not cleaned_nomor.startswith('analytics_'):
        analytics_nomor = f"analytics_{cleaned_nomor}"
        thread_id = nomor_to_thread.get(analytics_nomor)
        if thread_id:
            logger.info(f"Found thread ID {thread_id} for analytics prefix: {analytics_nomor}")
            return thread_id
            
        # Try analytics_ prefix with suffix
        if '@s.whatsapp.net' not in cleaned_nomor:
            analytics_suffixed = f"analytics_{cleaned_nomor}@s.whatsapp.net"
            thread_id = nomor_to_thread.get(analytics_suffixed)
            if thread_id:
                logger.info(f"Found thread ID {thread_id} for analytics suffixed: {analytics_suffixed}")
                return thread_id
    
    # Log available threads for debugging
    logger.warning(f"No thread found for {cleaned_nomor}. Available threads: {list(nomor_to_thread.keys())[:10]}")
    return None

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

# Delete thread for a specific user
def delete_thread_for_nomor(nomor: str) -> bool:
    """
    Delete thread mapping for a specific WhatsApp number
    
    Args:
        nomor: WhatsApp number with or without @s.whatsapp.net suffix
        
    Returns:
        bool: True if deletion was successful, False otherwise
    """
    try:
        # Normalize the phone number
        cleaned_nomor = nomor.strip()
        
        # Try direct removal
        if cleaned_nomor in nomor_to_thread:
            logger.info(f"[ThreadManager] Deleting thread for {cleaned_nomor}")
            del nomor_to_thread[cleaned_nomor]
            save_threads()
            return True
        
        # Try with and without @s.whatsapp.net suffix
        if '@s.whatsapp.net' in cleaned_nomor:
            base_nomor = cleaned_nomor.split('@')[0]
            if base_nomor in nomor_to_thread:
                logger.info(f"[ThreadManager] Deleting thread for base number {base_nomor}")
                del nomor_to_thread[base_nomor]
                save_threads()
                return True
        else:
            suffixed_nomor = f"{cleaned_nomor}@s.whatsapp.net"
            if suffixed_nomor in nomor_to_thread:
                logger.info(f"[ThreadManager] Deleting thread for suffixed number {suffixed_nomor}")
                del nomor_to_thread[suffixed_nomor]
                save_threads()
                return True
        
        # Try with analytics_ prefix
        if not cleaned_nomor.startswith('analytics_'):
            analytics_nomor = f"analytics_{cleaned_nomor}"
            if analytics_nomor in nomor_to_thread:
                logger.info(f"[ThreadManager] Deleting thread for analytics prefix {analytics_nomor}")
                del nomor_to_thread[analytics_nomor]
                save_threads()
                return True
            
            # Try analytics_ prefix with suffix
            if '@s.whatsapp.net' not in cleaned_nomor:
                analytics_suffixed = f"analytics_{cleaned_nomor}@s.whatsapp.net"
                if analytics_suffixed in nomor_to_thread:
                    logger.info(f"[ThreadManager] Deleting thread for analytics suffixed {analytics_suffixed}")
                    del nomor_to_thread[analytics_suffixed]
                    save_threads()
                    return True
        
        logger.warning(f"[ThreadManager] No thread found for {cleaned_nomor} to delete")
        return False
    except Exception as e:
        logger.error(f"[ThreadManager] Error deleting thread for {nomor}: {str(e)}")
        return False

# Utility to clear all (for admin/testing only)
def clear_all_threads():
    global nomor_to_thread
    nomor_to_thread = {}
    if os.path.exists(THREADS_FILE):
        os.remove(THREADS_FILE)
    save_threads()
    return True
