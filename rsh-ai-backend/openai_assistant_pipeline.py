import os
import json
import requests
import logging
import time
import re
from typing import Optional, Dict
from assistant_thread_manager import get_thread_id_for_nomor, set_thread_id_for_nomor, reset_thread_for_nomor, create_new_thread

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

def check_and_cancel_active_runs(thread_id: str, headers: dict) -> bool:
    """Check for any active runs on a thread and cancel them if found."""
    try:
        # Get list of runs for the thread
        runs_resp = requests.get(
            f"{OPENAI_API_URL}/threads/{thread_id}/runs",
            headers=headers,
            timeout=30
        )
        
        if runs_resp.status_code != 200:
            logger.error(f"[AssistantAPI] Failed to get runs for thread {thread_id}: {runs_resp.text}")
            return False
            
        runs_data = runs_resp.json()
        active_runs = []
        
        # Find any active runs
        for run in runs_data.get('data', []):
            status = run.get('status')
            if status in ['queued', 'in_progress', 'requires_action']:
                active_runs.append(run.get('id'))
                
        # Cancel any active runs
        for run_id in active_runs:
            logger.info(f"[AssistantAPI] Cancelling active run {run_id} on thread {thread_id}")
            cancel_resp = requests.post(
                f"{OPENAI_API_URL}/threads/{thread_id}/runs/{run_id}/cancel",
                headers=headers,
                timeout=30
            )
            
            if cancel_resp.status_code != 200:
                logger.warning(f"[AssistantAPI] Failed to cancel run {run_id}: {cancel_resp.text}")
                
        return len(active_runs) > 0
    except Exception as e:
        logger.error(f"[AssistantAPI] Error checking/cancelling runs: {str(e)}")
        return False

def wait_for_run_completion(thread_id: str, run_id: str, headers: dict, max_wait_time: int = 120) -> Optional[dict]:
    """Wait for a run to complete and return the result."""
    start_time = time.time()
    polling_interval = 2  # Start with 2 seconds
    max_polling_interval = 5  # Max 5 seconds between polls
    timeout_count = 0
    max_timeout_retries = 3
    
    logger.info(f"[AssistantAPI] Starting to wait for run {run_id} completion, max wait time: {max_wait_time} seconds")
    
    while time.time() - start_time < max_wait_time:
        try:
            logger.info(f"[AssistantAPI] Checking status of run {run_id}, elapsed time: {time.time() - start_time:.1f}s")
            
            run_resp = requests.get(
                f"{OPENAI_API_URL}/threads/{thread_id}/runs/{run_id}",
                headers=headers,
                timeout=30
            )
            
            if run_resp.status_code != 200:
                error_msg = f"[AssistantAPI] Failed to get run status: {run_resp.status_code} {run_resp.text}"
                logger.error(error_msg)
                
                # Increment timeout count and retry if not exceeded max retries
                timeout_count += 1
                if timeout_count <= max_timeout_retries:
                    logger.info(f"[AssistantAPI] Retrying after error ({timeout_count}/{max_timeout_retries})")
                    time.sleep(polling_interval)
                    continue
                else:
                    logger.error(f"[AssistantAPI] Max retries exceeded after errors")
                    return None
            
            # Reset timeout count on successful response
            timeout_count = 0
                
            run_data = run_resp.json()
            status = run_data.get('status')
            logger.info(f"[AssistantAPI] Run {run_id} status: {status}")
            
            if status == 'completed':
                logger.info(f"[AssistantAPI] Run {run_id} completed successfully after {time.time() - start_time:.1f} seconds")
                return run_data
            elif status == 'in_progress':
                logger.info(f"[AssistantAPI] Run {run_id} is in progress")
            elif status == 'queued':
                logger.info(f"[AssistantAPI] Run {run_id} is queued")
            elif status in ['failed', 'cancelled', 'expired']:
                logger.error(f"[AssistantAPI] Run {run_id} failed with status {status}: {run_data}")
                # Check for specific error information
                if 'last_error' in run_data:
                    logger.error(f"[AssistantAPI] Error details: {run_data['last_error']}")
                return None
            else:
                logger.warning(f"[AssistantAPI] Unknown run status: {status}")
                
            # Adaptive polling - increase interval gradually to reduce API calls
            polling_interval = min(polling_interval * 1.5, max_polling_interval)
            logger.info(f"[AssistantAPI] Waiting {polling_interval:.1f}s before next check")
            time.sleep(polling_interval)
            
        except requests.exceptions.Timeout:
            logger.warning(f"[AssistantAPI] Timeout while checking run status, retrying...")
            timeout_count += 1
            if timeout_count <= max_timeout_retries:
                time.sleep(polling_interval)
                continue
            else:
                logger.error(f"[AssistantAPI] Max timeout retries exceeded")
                return None
        except Exception as e:
            logger.error(f"[AssistantAPI] Error checking run status: {str(e)}")
            timeout_count += 1
            if timeout_count <= max_timeout_retries:
                time.sleep(polling_interval)
                continue
            else:
                logger.error(f"[AssistantAPI] Max error retries exceeded")
                return None
            
    logger.error(f"[AssistantAPI] Run {run_id} timed out after {max_wait_time} seconds")
    return None

def get_latest_assistant_message(thread_id: str, headers: dict) -> Optional[str]:
    """Get the latest assistant message from a thread."""
    try:
        msgs_resp = requests.get(
            f"{OPENAI_API_URL}/threads/{thread_id}/messages",
            headers=headers,
            timeout=30
        )
        
        if msgs_resp.status_code != 200:
            logger.error(f"[AssistantAPI] Failed to get messages: {msgs_resp.text}")
            return None
            
        msgs_data = msgs_resp.json()
        messages = msgs_data.get('data', [])
        
        # Find the latest assistant message
        for msg in messages:
            if msg.get('role') == 'assistant':
                content = msg.get('content', [])
                if content and isinstance(content, list):
                    for content_item in content:
                        if content_item.get('type') == 'text':
                            # Obtener el texto de la respuesta
                            response_text = content_item.get('text', {}).get('value')
                            if response_text:
                                # Aplicar regex para eliminar etiquetas de citación como 【12:34†fuente】
                                cleaned_response = re.sub(r"【\d+:\d+†[^】]+】", "", response_text)
                                logger.info(f"[AssistantAPI] Etiquetas de citación eliminadas de la respuesta")
                                return cleaned_response
                            return response_text
                            
        return None
    except Exception as e:
        logger.error(f"[AssistantAPI] Error getting latest message: {str(e)}")
        return None

def send_message_and_get_response(nomor: str, message: str) -> Optional[str]:
    try:
        # Get fresh headers for each request
        headers = get_headers()
        assistant_id = get_assistant_id()
        
        # Validasi API key dan Assistant ID
        if not headers.get('Authorization', '').startswith('Bearer '):
            logger.error("[AssistantAPI] API key tidak valid atau tidak ditemukan")
            return "Konfigurasi API key tidak valid. Silakan hubungi administrator."
            
        if not assistant_id:
            logger.error("[AssistantAPI] Assistant ID tidak ditemukan")
            return "Konfigurasi Assistant ID tidak valid. Silakan hubungi administrator."
        
        # Log API key info (partial, for security)
        api_key = headers.get('Authorization', '').replace('Bearer ', '')
        if api_key:
            logger.info(f"[AssistantAPI] Using API key: {api_key[:5]}...{api_key[-4:]} (length: {len(api_key)})")
        
        # Validasi dan bersihkan pesan input
        if not message or not isinstance(message, str):
            logger.error(f"[AssistantAPI] Pesan tidak valid: {message}")
            return "Pesan tidak valid. Silakan kirim pesan teks."
        
        # Hapus karakter khusus yang mungkin menyebabkan masalah
        cleaned_message = message.strip()
        
        # PRINSIP: SATU NOMOR WHATSAPP UNTUK SATU THREAD SAJA
        # Gunakan thread yang ada atau buat baru jika tidak ada
        thread_id = get_thread_id_for_nomor(nomor)
        
        if not thread_id:
            # Hanya buat thread baru jika nomor ini belum memiliki thread
            logger.info(f"[AssistantAPI] Tidak ada thread untuk nomor {nomor}, membuat thread baru")
            thread_id = create_new_thread(headers)
            if not thread_id:
                logger.error(f"[AssistantAPI] Gagal membuat thread baru untuk nomor {nomor}")
                return "Gagal membuat thread baru. Silakan coba lagi nanti."
            set_thread_id_for_nomor(nomor, thread_id)
            logger.info(f"[AssistantAPI] Thread baru dibuat dan disimpan untuk nomor {nomor}: {thread_id}")
        else:
            logger.info(f"[AssistantAPI] Menggunakan thread yang sudah ada untuk nomor {nomor}: {thread_id}")
        
        # Verifikasi thread hanya untuk memastikan masih valid, tapi JANGAN ganti kecuali benar-benar tidak bisa diakses
        try:
            thread_check = requests.get(
                f"{OPENAI_API_URL}/threads/{thread_id}",
                headers=headers,
                timeout=10
            )
            
            if thread_check.status_code != 200:
                # Thread tidak valid, ini kasus yang sangat jarang terjadi
                # Hanya buat thread baru jika thread benar-benar tidak dapat diakses
                logger.warning(f"[AssistantAPI] Thread {thread_id} untuk nomor {nomor} tidak dapat diakses: {thread_check.status_code}")
                
                # Coba sekali lagi untuk memastikan ini bukan masalah jaringan sementara
                time.sleep(2)
                retry_check = requests.get(
                    f"{OPENAI_API_URL}/threads/{thread_id}",
                    headers=headers,
                    timeout=10
                )
                
                if retry_check.status_code != 200:
                    # Benar-benar tidak dapat diakses, buat thread baru sebagai fallback terakhir
                    logger.error(f"[AssistantAPI] Thread {thread_id} benar-benar tidak dapat diakses setelah percobaan ulang")
                    new_thread_id = create_new_thread(headers)
                    
                    if not new_thread_id:
                        logger.error(f"[AssistantAPI] Gagal membuat thread baru untuk menggantikan thread yang tidak valid")
                        return "Terjadi masalah dengan thread percakapan. Silakan coba lagi nanti."
                        
                    # Catat thread lama yang diganti untuk debugging
                    logger.warning(f"[AssistantAPI] Mengganti thread untuk nomor {nomor}: {thread_id} -> {new_thread_id}")
                    thread_id = new_thread_id
                    set_thread_id_for_nomor(nomor, thread_id)
                else:
                    # Thread ternyata bisa diakses pada percobaan kedua
                    logger.info(f"[AssistantAPI] Thread {thread_id} berhasil diakses pada percobaan kedua")
        except Exception as e:
            # Jangan ganti thread jika terjadi error jaringan, gunakan thread yang ada
            logger.warning(f"[AssistantAPI] Error saat memeriksa thread {thread_id} untuk nomor {nomor}: {str(e)}")
            logger.info(f"[AssistantAPI] Tetap menggunakan thread yang sama meskipun terjadi error verifikasi")
        
        # Send message to thread
        logger.info(f"[AssistantAPI] Mengirim pesan ke thread {thread_id} untuk nomor {nomor}: {cleaned_message}")
        max_retries = 3
        retry_count = 0
        msg_id = None
        
        while retry_count < max_retries:
            try:
                msg_resp = requests.post(
                    f"{OPENAI_API_URL}/threads/{thread_id}/messages",
                    headers=headers,
                    json={"role": "user", "content": cleaned_message},
                    timeout=30
                )
                
                if msg_resp.status_code == 200:
                    # Log the message ID for debugging
                    msg_data = msg_resp.json()
                    msg_id = msg_data.get('id')
                    logger.info(f"[AssistantAPI] Message sent with ID: {msg_id}")
                    break
                elif msg_resp.status_code == 404 and retry_count == 0:
                    # Thread tidak ditemukan, ini kasus yang sangat jarang terjadi
                    logger.warning(f"[AssistantAPI] Thread {thread_id} untuk nomor {nomor} tidak ditemukan (404)")
                    
                    # Coba sekali lagi untuk memastikan ini bukan masalah jaringan sementara
                    time.sleep(2)
                    retry_check = requests.get(
                        f"{OPENAI_API_URL}/threads/{thread_id}",
                        headers=headers,
                        timeout=10
                    )
                    
                    if retry_check.status_code == 404:
                        # Thread benar-benar tidak ditemukan, buat thread baru sebagai fallback terakhir
                        logger.error(f"[AssistantAPI] Thread {thread_id} benar-benar tidak ditemukan setelah percobaan ulang")
                        new_thread_id = create_new_thread(headers)
                        
                        if not new_thread_id:
                            return "Terjadi masalah dengan thread percakapan. Silakan coba lagi nanti."
                            
                        # Catat thread lama yang diganti untuk debugging
                        logger.warning(f"[AssistantAPI] Terpaksa mengganti thread untuk nomor {nomor} karena 404: {thread_id} -> {new_thread_id}")
                        thread_id = new_thread_id
                        set_thread_id_for_nomor(nomor, thread_id)
                        retry_count += 1
                        continue
                    elif retry_check.status_code == 200:
                        # Thread ternyata ada pada percobaan kedua, coba kirim pesan lagi
                        logger.info(f"[AssistantAPI] Thread {thread_id} ternyata ada pada percobaan kedua, mencoba kirim pesan lagi")
                        retry_count += 1
                        continue
                    else:
                        # Ada masalah lain, lanjutkan dengan retry normal
                        logger.warning(f"[AssistantAPI] Respons tidak terduga saat memeriksa thread: {retry_check.status_code}")
                        retry_count += 1
                        time.sleep(2)
                        continue
                else:
                    logger.error(f"[AssistantAPI] Gagal mengirim pesan (attempt {retry_count+1}/{max_retries}): {msg_resp.status_code} {msg_resp.text}")
                    retry_count += 1
                    time.sleep(2)  # Wait before retrying
            except Exception as e:
                logger.error(f"[AssistantAPI] Error sending message (attempt {retry_count+1}/{max_retries}): {str(e)}")
                retry_count += 1
                time.sleep(2)  # Wait before retrying
        
        if not msg_id:
            return "Gagal mengirim pesan ke Assistant setelah beberapa percobaan. Silakan coba lagi nanti."
        
        # Create a new run with the assistant
        logger.info(f"[AssistantAPI] Creating run with assistant {assistant_id} for thread {thread_id}")
        run_id = None
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                run_resp = requests.post(
                    f"{OPENAI_API_URL}/threads/{thread_id}/runs",
                    headers=headers,
                    json={
                        "assistant_id": assistant_id
                    },
                    timeout=30
                )
                
                if run_resp.status_code == 200:
                    run_data = run_resp.json()
                    run_id = run_data.get('id')
                    logger.info(f"[AssistantAPI] Run created with ID: {run_id}")
                    break
                else:
                    logger.error(f"[AssistantAPI] Failed to create run (attempt {retry_count+1}/{max_retries}): {run_resp.status_code} {run_resp.text}")
                    retry_count += 1
                    time.sleep(2)  # Wait before retrying
            except Exception as e:
                logger.error(f"[AssistantAPI] Error creating run (attempt {retry_count+1}/{max_retries}): {str(e)}")
                retry_count += 1
                time.sleep(2)  # Wait before retrying
        
        if not run_id:
            return "Gagal membuat run dengan Assistant setelah beberapa percobaan. Silakan coba lagi nanti."
        
        # Wait for run to complete
        logger.info(f"[AssistantAPI] Waiting for run {run_id} to complete")
        completed_run = wait_for_run_completion(thread_id, run_id, headers)
        
        if not completed_run:
            logger.error(f"[AssistantAPI] Run did not complete successfully")
            # Try to get the latest message anyway
            latest_message = get_latest_assistant_message(thread_id, headers)
            if latest_message:
                logger.info(f"[AssistantAPI] Retrieved message despite run failure: {latest_message[:100]}...")
                return latest_message
            else:
                # Fallback to a default response
                return "Maaf, saya sedang mengalami masalah teknis. Silakan coba lagi dalam beberapa saat."
        
        # Get the latest message from the assistant
        logger.info(f"[AssistantAPI] Getting latest message from thread {thread_id}")
        retry_count = 0
        latest_message = None
        
        while retry_count < max_retries and not latest_message:
            latest_message = get_latest_assistant_message(thread_id, headers)
            if not latest_message:
                logger.warning(f"[AssistantAPI] No message found on attempt {retry_count+1}/{max_retries}, retrying...")
                retry_count += 1
                time.sleep(2)  # Wait before retrying
        
        if not latest_message:
            logger.error(f"[AssistantAPI] No assistant message found after {max_retries} attempts")
            return "Maaf, saya tidak dapat memberikan respons saat ini. Silakan coba lagi nanti."
        
        logger.info(f"[AssistantAPI] Retrieved response: {latest_message[:100]}...")
        return latest_message
    
    except Exception as e:
        logger.error(f"[AssistantAPI] Unexpected error in send_message_and_get_response: {str(e)}")
        return f"Terjadi kesalahan tak terduga: {str(e)}. Silakan coba lagi nanti."
