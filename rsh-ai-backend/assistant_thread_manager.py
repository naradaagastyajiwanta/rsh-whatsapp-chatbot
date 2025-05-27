import os
import json
from typing import Optional

THREADS_FILE = os.path.join(os.path.dirname(__file__), "assistant_threads.json")

# Load or initialize mapping nomor WhatsApp -> thread_id
if os.path.exists(THREADS_FILE):
    with open(THREADS_FILE, "r", encoding="utf-8") as f:
        nomor_to_thread = json.load(f)
else:
    nomor_to_thread = {}

def save_threads():
    with open(THREADS_FILE, "w", encoding="utf-8") as f:
        json.dump(nomor_to_thread, f, ensure_ascii=False, indent=2)

def get_thread_id_for_nomor(nomor: str) -> Optional[str]:
    return nomor_to_thread.get(nomor)

def set_thread_id_for_nomor(nomor: str, thread_id: str):
    nomor_to_thread[nomor] = thread_id
    save_threads()

# Utility to clear all (for admin/testing only)
def clear_all_threads():
    global nomor_to_thread
    nomor_to_thread = {}
    if os.path.exists(THREADS_FILE):
        os.remove(THREADS_FILE)
    save_threads()
    return True
