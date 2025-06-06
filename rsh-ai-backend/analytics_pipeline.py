import os
import json
import logging
import requests
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from openai import OpenAI
from assistant_thread_manager import get_thread_id_for_nomor, set_thread_id_for_nomor

logger = logging.getLogger(__name__)

OPENAI_API_URL = "https://api.openai.com/v1"

class AnalyticsPipeline:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.analytics_dir = "analytics_data"
        self.ensure_analytics_dir()
        
    def ensure_analytics_dir(self):
        """Memastikan direktori analytics ada"""
        if not os.path.exists(self.analytics_dir):
            os.makedirs(self.analytics_dir)
            
        # File untuk menyimpan performa metrics
        self.performance_file = os.path.join(self.analytics_dir, "performance_metrics.json")
        if not os.path.exists(self.performance_file):
            with open(self.performance_file, "w") as f:
                json.dump({
                    "api_calls": 0,
                    "total_response_time": 0,
                    "average_response_time": 0,
                    "success_rate": 100,
                    "error_count": 0,
                    "daily_metrics": {}
                }, f)
                
        # File untuk menyimpan user insights
        self.insights_file = os.path.join(self.analytics_dir, "user_insights.json")
        if not os.path.exists(self.insights_file):
            with open(self.insights_file, "w") as f:
                json.dump({}, f)

    def get_headers(self) -> Dict[str, str]:
        """Get headers for OpenAI API request with fresh API key."""
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            logger.error("[AnalyticsAPI] OPENAI_API_KEY tidak ditemukan di environment variables")
            raise ValueError("OPENAI_API_KEY tidak ditemukan")
        
        logger.info(f"[AnalyticsAPI] API Key length: {len(api_key)} karakter")
        return {
            "Authorization": f"Bearer {api_key}",
            "OpenAI-Beta": "assistants=v2",
            "Content-Type": "application/json"
        }
    
    def get_analytics_assistant_id(self) -> str:
        """Get Analytics Assistant ID from environment variable or use default."""
        # Use the new assistant ID provided by the user
        assistant_id = "asst_k4czbHkK3SwlFNlCJrgpZZhL"
        logger.info(f"[AnalyticsAPI] Using Analytics Assistant ID: {assistant_id}")
        return assistant_id
        
    def ensure_analytics_thread_for_nomor(self, nomor: str) -> Optional[str]:
        """Ensure a thread exists for analytics purposes"""
        try:
            # Use a different prefix for analytics threads to avoid conflicts
            analytics_nomor = f"analytics_{nomor}"
            thread_id = get_thread_id_for_nomor(analytics_nomor)
            if thread_id:
                logger.info(f"[AnalyticsAPI] Thread sudah ada untuk nomor {analytics_nomor}: {thread_id}")
                return thread_id
            
            # Create new thread
            logger.info(f"[AnalyticsAPI] Membuat thread baru untuk nomor {analytics_nomor}")
            headers = self.get_headers()
            resp = requests.post(f"{OPENAI_API_URL}/threads", headers=headers, json={})
            resp_json = resp.json()
            logger.info(f"[AnalyticsAPI] Response create thread: {resp.status_code} {resp_json}")
            
            if resp.status_code == 200:
                thread_id = resp_json.get("id")
                if not thread_id:
                    logger.error("[AnalyticsAPI] Thread ID tidak ditemukan di response")
                    return None
                set_thread_id_for_nomor(analytics_nomor, thread_id)
                return thread_id
                
            logger.error(f"[AnalyticsAPI] Gagal membuat thread: {resp_json}")
            return None
        except Exception as e:
            logger.error(f"[AnalyticsAPI] Error saat membuat/mengambil thread: {str(e)}")
            return None
    
    def analyze_chat_message(self, sender: str, message: str) -> Dict:
        """Menganalisis pesan chat untuk mendapatkan insights tentang pengguna menggunakan OpenAI Assistant API"""
        try:
            # Ensure thread exists for this sender
            thread_id = self.ensure_analytics_thread_for_nomor(sender)
            if not thread_id:
                logger.error(f"[AnalyticsAPI] Tidak dapat membuat/mengambil thread untuk nomor {sender}")
                return {}
            
            # Get fresh headers for each request
            headers = self.get_headers()
            assistant_id = self.get_analytics_assistant_id()
            
            # Send user message directly to the Assistant
            # Since the Assistant already has the initial prompt configured, we don't need to send the system message
            logger.info(f"[AnalyticsAPI] Mengirim pesan untuk analisis ke thread {thread_id}: {message}")
            msg_resp = requests.post(
                f"{OPENAI_API_URL}/threads/{thread_id}/messages",
                headers=headers,
                json={"role": "user", "content": message}
            )
            
            if msg_resp.status_code != 200:
                logger.error(f"[AnalyticsAPI] Gagal mengirim pesan: {msg_resp.json()}")
                return {}
            
            # Run assistant
            logger.info(f"[AnalyticsAPI] Menjalankan Assistant {assistant_id} untuk thread {thread_id}")
            run_resp = requests.post(
                f"{OPENAI_API_URL}/threads/{thread_id}/runs",
                headers=headers,
                json={"assistant_id": assistant_id}
            )
            
            run_json = run_resp.json()
            if run_resp.status_code != 200:
                logger.error(f"[AnalyticsAPI] Gagal memulai run: {run_json}")
                return {}
            
            run_id = run_json.get("id")
            if not run_id:
                logger.error("[AnalyticsAPI] Run ID tidak ditemukan di response")
                return {}
            
            # Poll for run completion
            max_attempts = 30
            attempts = 0
            while attempts < max_attempts:
                attempts += 1
                logger.info(f"[AnalyticsAPI] Polling run status (attempt {attempts}/{max_attempts})")
                
                run_status_resp = requests.get(
                    f"{OPENAI_API_URL}/threads/{thread_id}/runs/{run_id}",
                    headers=headers
                )
                
                if run_status_resp.status_code != 200:
                    logger.error(f"[AnalyticsAPI] Gagal mendapatkan status run: {run_status_resp.json()}")
                    break
                
                status_json = run_status_resp.json()
                status = status_json.get("status")
                
                if status in ["completed", "failed", "cancelled", "expired"]:
                    logger.info(f"[AnalyticsAPI] Run selesai dengan status: {status}")
                    break
                
                import time
                time.sleep(1)  # Wait 1 second before polling again
            
            if status != "completed":
                logger.error(f"[AnalyticsAPI] Run tidak selesai dengan sukses. Status: {status}")
                return {}
            
            # Get messages
            msgs_resp = requests.get(
                f"{OPENAI_API_URL}/threads/{thread_id}/messages",
                headers=headers
            )
            
            if msgs_resp.status_code != 200:
                logger.error(f"[AnalyticsAPI] Gagal mengambil pesan: {msgs_resp.json()}")
                return {}
            
            messages = msgs_resp.json().get("data", [])
            if not messages:
                logger.error("[AnalyticsAPI] Tidak ada pesan dari Assistant")
                return {}
            
            # Get latest assistant message
            assistant_message = None
            for msg in messages:
                if msg.get("role") == "assistant":
                    content = msg.get("content", [])
                    if content and isinstance(content, list):
                        text_content = content[0].get("text", {}).get("value")
                        if text_content:
                            assistant_message = text_content
                            break
            
            if not assistant_message:
                logger.error("[AnalyticsAPI] Tidak menemukan pesan dari Assistant")
                return {}
            
            # Parse response menjadi JSON
            try:
                analysis = json.loads(assistant_message)
                analysis['timestamp'] = datetime.now().isoformat()
                
                # Simpan hasil analisis
                self._save_user_insight(sender, analysis)
                
                # Emit WebSocket event jika handler tersedia
                if hasattr(self, 'websocket_handler') and self.websocket_handler:
                    self.websocket_handler.emit('analytics_update', {'type': 'user_insight', 'data': {'sender': sender, 'analysis': analysis}})
                
                return analysis
            except json.JSONDecodeError as e:
                logger.error(f"[AnalyticsAPI] Gagal parsing response JSON: {str(e)}")
                logger.error(f"[AnalyticsAPI] Response content: {assistant_message}")
                return {}
            
        except Exception as e:
            logger.error(f"[AnalyticsAPI] Error saat menganalisis pesan: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return {}
            
    def log_api_performance(self, 
                          success: bool, 
                          response_time: float, 
                          error_message: Optional[str] = None):
        """Log metrik performa API"""
        try:
            with open(self.performance_file, "r") as f:
                metrics = json.load(f)
                
            # Update metrics
            metrics["api_calls"] += 1
            metrics["total_response_time"] += response_time
            metrics["average_response_time"] = metrics["total_response_time"] / metrics["api_calls"]
            
            if not success:
                metrics["error_count"] += 1
                
            metrics["success_rate"] = ((metrics["api_calls"] - metrics["error_count"]) / metrics["api_calls"]) * 100
            
            # Update daily metrics
            today = datetime.now().strftime("%Y-%m-%d")
            if today not in metrics["daily_metrics"]:
                metrics["daily_metrics"][today] = {
                    "api_calls": 0,
                    "total_response_time": 0,
                    "error_count": 0
                }
                
            daily = metrics["daily_metrics"][today]
            daily["api_calls"] += 1
            daily["total_response_time"] += response_time
            if not success:
                daily["error_count"] += 1
                
            # Simpan metrics
            with open(self.performance_file, "w") as f:
                json.dump(metrics, f, indent=2)
            
            # Log untuk debugging
            logger.info(f"Updated performance metrics: API calls={metrics['api_calls']}, Avg response time={metrics['average_response_time']:.2f}ms")
            
            # Emit WebSocket event jika handler tersedia
            if hasattr(self, 'websocket_handler') and self.websocket_handler:
                # Kirim update performance metrics
                self.websocket_handler.emit('analytics_update', {
                    'type': 'performance',
                    'data': metrics
                })
                
        except Exception as e:
            logger.error(f"Error saat logging performa: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            
    def _validate_analysis(self, analysis: Dict) -> Dict:
        """Validasi dan normalisasi data analisis
        
        Args:
            analysis: Data analisis dari GPT-4
            
        Returns:
            Dict: Data yang sudah divalidasi dan dinormalisasi
        """
        validated = {}
        
        # Konversi field bahasa Indonesia ke bahasa Inggris
        if 'nama' in analysis and 'name' not in analysis:
            analysis['name'] = analysis['nama']
        if 'usia' in analysis and 'age' not in analysis:
            analysis['age'] = analysis['usia']
        if 'jenis_keluhan' in analysis and 'health_complaints' not in analysis:
            analysis['health_complaints'] = analysis['jenis_keluhan']
        if 'gejala' in analysis and 'symptoms' not in analysis:
            analysis['symptoms'] = analysis['gejala']
        if 'riwayat_penyakit' in analysis and 'medical_history' not in analysis:
            analysis['medical_history'] = analysis['riwayat_penyakit']
        if 'tingkat_urgensi' in analysis and 'urgency_level' not in analysis:
            urgency = analysis['tingkat_urgensi']
            if urgency in ['rendah', 'low']:
                analysis['urgency_level'] = 'low'
            elif urgency in ['sedang', 'medium']:
                analysis['urgency_level'] = 'medium'
            elif urgency in ['tinggi', 'high']:
                analysis['urgency_level'] = 'high'
            else:
                analysis['urgency_level'] = None
        if 'emosi' in analysis and 'emotion' not in analysis:
            emotion = analysis['emosi']
            if emotion in ['positif', 'positive']:
                analysis['emotion'] = 'positive'
            elif emotion in ['netral', 'neutral']:
                analysis['emotion'] = 'neutral'
            elif emotion in ['negatif', 'negative']:
                analysis['emotion'] = 'negative'
            else:
                analysis['emotion'] = 'neutral'
        
        # Validasi field dasar
        validated['name'] = str(analysis.get('name')) if analysis.get('name') else None
        validated['age'] = int(analysis['age']) if analysis.get('age') and str(analysis['age']).isdigit() else None
        
        # Normalisasi gender
        gender = analysis.get('gender', '').lower()
        if gender in ['male', 'laki', 'laki-laki', 'pria']:
            validated['gender'] = 'male'
        elif gender in ['female', 'perempuan', 'wanita']:
            validated['gender'] = 'female'
        else:
            validated['gender'] = None
            
        # Validasi location
        validated['location'] = str(analysis.get('location')) if analysis.get('location') else None
        
        # Validasi health_complaints - pastikan selalu array
        health_complaints = analysis.get('health_complaints', [])
        if health_complaints is None:
            validated['health_complaints'] = []
        elif isinstance(health_complaints, str):
            validated['health_complaints'] = [health_complaints]
        elif isinstance(health_complaints, list):
            validated['health_complaints'] = [
                str(complaint) for complaint in health_complaints
                if complaint and isinstance(complaint, (str, int, float))
            ]
        else:
            validated['health_complaints'] = []
        
        # Validasi symptoms - pastikan selalu array
        symptoms = analysis.get('symptoms', [])
        if symptoms is None:
            validated['symptoms'] = []
        elif isinstance(symptoms, str):
            validated['symptoms'] = [symptoms]
        elif isinstance(symptoms, list):
            validated['symptoms'] = [
                str(symptom) for symptom in symptoms
                if symptom and isinstance(symptom, (str, int, float))
            ]
        else:
            validated['symptoms'] = []
        
        # Validasi conversion_barriers - pastikan selalu array
        barriers = analysis.get('conversion_barriers', [])
        if barriers is None:
            validated['conversion_barriers'] = []
        elif isinstance(barriers, str):
            validated['conversion_barriers'] = [barriers]
        elif isinstance(barriers, list):
            validated['conversion_barriers'] = [
                str(barrier) for barrier in barriers
                if barrier and isinstance(barrier, (str, int, float))
            ]
        else:
            validated['conversion_barriers'] = []
        
        # Validasi medical_history
        validated['medical_history'] = str(analysis.get('medical_history')) if analysis.get('medical_history') else None
        
        # Validasi urgency_level
        urgency = analysis.get('urgency_level')
        if urgency in ['low', 'medium', 'high']:
            validated['urgency_level'] = urgency
        else:
            validated['urgency_level'] = None
        
        # Validasi emotion
        emotion = analysis.get('emotion')
        if emotion in ['positive', 'neutral', 'negative']:
            validated['emotion'] = emotion
        else:
            validated['emotion'] = 'neutral'
        
        # Timestamp
        validated['timestamp'] = analysis.get('timestamp') or datetime.now().isoformat()
        
        return validated

    def _save_user_insight(self, sender: str, analysis: Dict):
        """Simpan hasil analisis untuk pengguna tertentu"""
        try:
            # Validasi data sebelum disimpan
            validated_analysis = self._validate_analysis(analysis)
            
            # Ensure analytics directory exists
            self.ensure_analytics_dir()
            
            try:
                with open(self.insights_file, "r") as f:
                    insights = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                insights = {}
                
            current_time = datetime.now().isoformat()
            
            # Pastikan struktur data dasar ada
            if sender not in insights:
                insights[sender] = {
                    "interactions": [],
                    "first_interaction": current_time,
                    "details": {
                        "name": None,
                        "age": None,
                        "gender": None,
                        "location": None,
                        "health_complaints": [],
                        "conversion_barriers": [],
                        "last_interaction": current_time
                    }
                }
            
            # Update user details dengan data yang sudah divalidasi
            user_details = insights[sender]["details"]
            
            # Update field dasar jika ada nilai baru yang valid
            for field in ["name", "age", "gender", "location"]:
                if validated_analysis.get(field) is not None:
                    user_details[field] = validated_analysis[field]
            
            # Update lists dengan menghindari duplikat
            if validated_analysis.get("health_complaints"):
                existing = set(user_details.get("health_complaints", []) or [])
                new = set(validated_analysis.get("health_complaints", []) or [])
                user_details["health_complaints"] = list(existing | new)  # union of sets
            
            if validated_analysis.get("conversion_barriers"):
                existing = set(user_details.get("conversion_barriers", []) or [])
                new = set(validated_analysis.get("conversion_barriers", []) or [])
                user_details["conversion_barriers"] = list(existing | new)
            
            # Pastikan semua field yang diharapkan frontend ada
            if "symptoms" not in user_details and "symptoms" in validated_analysis:
                user_details["symptoms"] = validated_analysis["symptoms"]
                
            if "medical_history" not in user_details and "medical_history" in validated_analysis:
                user_details["medical_history"] = validated_analysis["medical_history"]
                
            if "urgency_level" not in user_details and "urgency_level" in validated_analysis:
                user_details["urgency_level"] = validated_analysis["urgency_level"]
                
            if "emotion" not in user_details and "emotion" in validated_analysis:
                user_details["emotion"] = validated_analysis["emotion"]
            
            user_details["last_interaction"] = current_time
            
            # Tambahkan analisis baru ke interactions
            insights[sender]["interactions"].append({
                "timestamp": current_time,
                "analysis": validated_analysis
            })
            
            # Update latest analysis
            insights[sender]["latest_analysis"] = validated_analysis
            
            # Simpan ke file
            with open(self.insights_file, "w") as f:
                json.dump(insights, f, indent=2)
            
            # Log untuk debugging
            logger.info(f"Saved user insight for {sender}")
            logger.debug(f"User details: {json.dumps(user_details)}")
            logger.debug(f"Latest analysis: {json.dumps(validated_analysis)}")
                
            # Emit WebSocket event jika handler tersedia
            if hasattr(self, 'websocket_handler') and self.websocket_handler:
                # Kirim update ke semua klien yang terhubung
                self.websocket_handler.emit('analytics_update', {
                    'type': 'user_insight_update',  # Konsistensi nama event
                    'data': {
                        'sender': sender,
                        'details': user_details,
                        'latest_analysis': validated_analysis
                    }
                })
                
                # Kirim update user analytics keseluruhan
                all_user_insights = self.get_user_insights()
                self.websocket_handler.emit('analytics_update', {
                    'type': 'users',
                    'data': all_user_insights
                })
                
        except Exception as e:
            logger.error(f"Error saat menyimpan insight: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            raise
            
    def get_performance_metrics(self, days: int = 7) -> Dict:
        """Ambil metrik performa untuk N hari terakhir"""
        try:
            with open(self.performance_file, "r") as f:
                metrics = json.load(f)
                
            # Filter daily metrics untuk N hari terakhir
            cutoff = datetime.now() - timedelta(days=days)
            filtered_daily = {
                date: data 
                for date, data in metrics["daily_metrics"].items()
                if datetime.strptime(date, "%Y-%m-%d") >= cutoff
            }
            
            metrics["daily_metrics"] = filtered_daily
            return metrics
            
        except Exception as e:
            logger.error(f"Error saat mengambil metrik: {str(e)}")
            return {}
            
    def migrate_user_data(self):
        """Migrasi data user lama ke format baru"""
        try:
            with open(self.insights_file, "r") as f:
                insights = json.load(f)
            
            modified = False
            current_time = datetime.now().isoformat()
            
            for sender, data in insights.items():
                if 'details' not in data:
                    # Ambil data dari latest_analysis jika ada
                    latest = data.get('latest_analysis', {})
                    
                    # Buat struktur details baru
                    data['details'] = {
                        'name': latest.get('name') or latest.get('nama'),
                        'age': latest.get('age') or latest.get('usia'),
                        'gender': latest.get('gender') or None,
                        'location': latest.get('location') or None,
                        'health_complaints': latest.get('health_complaints', []) or 
                                           latest.get('jenis_keluhan', []),
                        'conversion_barriers': latest.get('conversion_barriers', []),
                        'last_interaction': data.get('interactions', [{}])[-1].get('timestamp', current_time)
                    }
                    modified = True
                    
            if modified:
                with open(self.insights_file, "w") as f:
                    json.dump(insights, f, indent=2)
                    
            return insights
        except Exception as e:
            logger.error(f"[AnalyticsAPI] Error menghapus data analytics untuk {phone_number}: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return False

    def get_user_insights(self, sender: Optional[str] = None) -> Dict:
        """Ambil insights untuk semua user atau user tertentu"""
        try:
            # Ensure analytics directory exists
            self.ensure_analytics_dir()
            
            try:
                with open(self.insights_file, "r") as f:
                    insights = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                insights = {}
                
            if sender:
                # Return insights for specific sender
                if sender in insights:
                    return {"users": {sender: insights[sender]}}
                else:
                    return {"users": {}}
            else:
                # Return all insights
                return {"users": insights}
        except Exception as e:
            logger.error(f"Error saat mengambil user insights: {str(e)}")
            return {"users": {}}
                
    def delete_user_insights(self, phone_number: str) -> bool:
        """Hapus data analytics untuk nomor telepon tertentu
        
        Args:
            phone_number: Nomor telepon yang akan dihapus datanya
            
        Returns:
            bool: True jika berhasil dihapus, False jika gagal
        """
        try:
            # Normalize input
            cleaned_nomor = phone_number.strip()
            
            # Ensure analytics directory exists
            self.ensure_analytics_dir()
            
            try:
                with open(self.insights_file, "r") as f:
                    insights = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                logger.warning(f"[AnalyticsAPI] Analytics file tidak ditemukan atau kosong saat mencoba menghapus {cleaned_nomor}")
                return False
            
            deleted = False
            
            # Coba hapus dengan format nomor yang berbeda
            formats_to_try = [
                cleaned_nomor,  # Format asli
                cleaned_nomor.split('@')[0] if '@' in cleaned_nomor else cleaned_nomor,  # Tanpa suffix
                f"{cleaned_nomor}@s.whatsapp.net" if '@' not in cleaned_nomor else cleaned_nomor,  # Dengan suffix
                f"analytics_{cleaned_nomor}" if not cleaned_nomor.startswith('analytics_') else cleaned_nomor,  # Dengan prefix
                f"analytics_{cleaned_nomor.split('@')[0]}" if '@' in cleaned_nomor and not cleaned_nomor.startswith('analytics_') else cleaned_nomor  # Dengan prefix tanpa suffix
            ]
            
            for format_nomor in formats_to_try:
                if format_nomor in insights:
                    logger.info(f"[AnalyticsAPI] Menghapus data analytics untuk {format_nomor}")
                    del insights[format_nomor]
                    deleted = True
            
            if deleted:
                # Simpan perubahan ke file
                with open(self.insights_file, "w") as f:
                    json.dump(insights, f, indent=2)
                
                # Emit WebSocket event jika handler tersedia
                if hasattr(self, 'websocket_handler') and self.websocket_handler:
                    self.websocket_handler.emit('analytics_update', {
                        'type': 'user_deleted',
                        'data': {
                            'phone_number': cleaned_nomor,
                            'timestamp': datetime.now().isoformat()
                        }
                    })
                    
                    # Kirim update user analytics keseluruhan
                    all_user_insights = self.get_user_insights()
                    self.websocket_handler.emit('analytics_update', {
                        'type': 'users',
                        'data': all_user_insights
                    })
                
                logger.info(f"[AnalyticsAPI] Berhasil menghapus data analytics untuk {cleaned_nomor}")
                return True
            else:
                logger.warning(f"[AnalyticsAPI] Tidak ada data analytics ditemukan untuk {cleaned_nomor}")
                return False
                
        except Exception as e:
            logger.error(f"[AnalyticsAPI] Error menghapus data analytics untuk {phone_number}: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return False
            
    def _ensure_field_exists(self, data_dict: Dict, field_name: str, default_value: Any) -> None:
        """Memastikan field tertentu ada dalam dictionary
        
        Args:
            data_dict: Dictionary yang akan dimodifikasi
            field_name: Nama field yang akan dipastikan ada
            default_value: Nilai default jika field tidak ada
        """
        if field_name not in data_dict:
            data_dict[field_name] = default_value
            
    def _ensure_array_field(self, data_dict: Dict, field_name: str) -> None:
        """Memastikan field array tertentu ada dan berformat array
        
        Args:
            data_dict: Dictionary yang akan dimodifikasi
            field_name: Nama field array yang akan dipastikan ada
        """
        if field_name not in data_dict:
            data_dict[field_name] = []
        elif data_dict[field_name] is None:
            data_dict[field_name] = []
        elif isinstance(data_dict[field_name], str):
            data_dict[field_name] = [data_dict[field_name]]
        elif not isinstance(data_dict[field_name], list):
            data_dict[field_name] = []

# Create singleton instance
analytics = AnalyticsPipeline()
