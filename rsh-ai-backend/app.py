import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import time
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Verify OpenAI API key is loaded
api_key = os.getenv('OPENAI_API_KEY')
if not api_key:
    raise ValueError('OPENAI_API_KEY not found in environment variables')
from rag_pipeline import RAGPipeline
from mock_rag_pipeline import MockRAGPipeline
from openai_assistant_pipeline import send_message_and_get_response
from admin_routes import admin_bp, log_chat_message
from document_routes import document_bp
from chatbot_settings import get_settings, update_settings
from websocket_handler import init_websocket
from analytics_pipeline import analytics
from user_preferences import user_preferences

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Log environment variables for debugging
api_key = os.getenv('OPENAI_API_KEY')
assistant_id = os.getenv('OPENAI_ASSISTANT_ID')

logger.info(f"[ENV] OPENAI_API_KEY exists: {bool(api_key)}")
logger.info(f"[ENV] OPENAI_API_KEY length: {len(api_key) if api_key else 0}")
logger.info(f"[ENV] OPENAI_ASSISTANT_ID: {assistant_id}")

if not api_key:
    logger.error("[ENV] OPENAI_API_KEY tidak ditemukan di environment variables!")
if not assistant_id:
    logger.error("[ENV] OPENAI_ASSISTANT_ID tidak ditemukan di environment variables!")

# Initialize Flask app
app = Flask(__name__)

# Configure CORS to allow requests from the frontend
allowed_origins = [
    'http://localhost:3000',  # Next.js development server
    'http://127.0.0.1:3000',
    'http://localhost:8080',  # Alternative port
    'http://127.0.0.1:8080'
]

# Enable CORS with specific configuration
CORS(app, 
     resources={r"/*": {
         "origins": allowed_origins, 
         "supports_credentials": True,
         "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
         "expose_headers": ["Content-Type", "Authorization"],
         "allow_methods": ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
         "max_age": 3600
     }})

# Add CORS headers to all responses
@app.after_request
def after_request(response):
    # Bypass cache-control for preflight requests
    if request.method == 'OPTIONS':
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With')
        response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PUT,DELETE')
        # Remove cache-control header which is causing issues
        if 'Cache-Control' in response.headers:
            del response.headers['Cache-Control']
    return response

# Register blueprints
app.register_blueprint(admin_bp, url_prefix='/admin')
app.register_blueprint(document_bp, url_prefix='/documents')

# Add a route to handle CORS preflight requests
@app.route('/health', methods=['GET', 'OPTIONS'])
def health():
    """Health check endpoint to verify server is running"""
    if request.method == 'OPTIONS':
        # Handle CORS preflight request
        response = jsonify({'status': 'ok'})
        return response
    
    return jsonify({
        'status': 'ok',
        'version': '1.0.0',
        'server_time': time.time()
    })

# Initialize RAG pipeline
rag_pipeline = None

def initialize_rag_pipeline():
    global rag_pipeline
    try:
        # Try to initialize the real RAG pipeline
        rag_pipeline = RAGPipeline(
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            pinecone_api_key=os.getenv("PINECONE_API_KEY"),
            pinecone_environment=os.getenv("PINECONE_ENVIRONMENT"),
            index_name=os.getenv("PINECONE_INDEX_NAME", "rsh-chatbot-index"),
            model_name=os.getenv("OPENAI_MODEL_NAME", "gpt-3.5-turbo")
        )
        logger.info("RAG pipeline initialized successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize real RAG pipeline: {str(e)}")
        logger.info("Falling back to mock RAG pipeline")
        try:
            # Fall back to the mock RAG pipeline
            rag_pipeline = MockRAGPipeline(
                openai_api_key=os.getenv("OPENAI_API_KEY"),
                pinecone_api_key=os.getenv("PINECONE_API_KEY"),
                pinecone_environment=os.getenv("PINECONE_ENVIRONMENT"),
                index_name=os.getenv("PINECONE_INDEX_NAME", "rsh-chatbot-index"),
                model_name=os.getenv("OPENAI_MODEL_NAME", "gpt-3.5-turbo")
            )
            logger.info("Mock RAG pipeline initialized successfully")
            return True
        except Exception as mock_e:
            logger.error(f"Failed to initialize mock RAG pipeline: {str(mock_e)}")
            return False

# Try to initialize the RAG pipeline, but don't stop the server if it fails
try:
    initialize_rag_pipeline()
except Exception as e:
    logger.error(f"Initial RAG pipeline initialization failed: {str(e)}")
    logger.info("Server will start anyway, and RAG pipeline initialization will be retried on requests")

# Routes for the main app

# Routes for the main app

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    global rag_pipeline
    
    status = "ok" if rag_pipeline is not None else "degraded"
    
    # Check if we're using the mock pipeline
    using_mock = rag_pipeline is not None and isinstance(rag_pipeline, MockRAGPipeline)
    
    if rag_pipeline is None:
        message = "RSH AI Backend is running but RAG pipeline is not initialized"
        pinecone_status = "disconnected"
    elif using_mock:
        message = "RSH AI Backend is running with mock RAG pipeline (Pinecone unavailable)"
        pinecone_status = "disconnected"
    else:
        message = "RSH AI Backend is running with real RAG pipeline"
        pinecone_status = "connected"
    
    return jsonify({
        "status": status,
        "message": message,
        "pinecone_status": pinecone_status,
        "using_mock": using_mock if rag_pipeline is not None else False
    }), 200

@app.route('/ask', methods=['POST'])
def ask():
    """
    Process incoming messages from WhatsApp service
    Expected request format:
    {
        "sender": "6281234567890@s.whatsapp.net",
        "message": "Pertanyaan dari pengguna",
        "sender_name": "User Name" (optional),
        "request_id": "unique_request_id" (optional),
        "timestamp": 1621234567890 (optional)
    }
    """
    # Set no-cache headers for response
    response_headers = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    }
    
    # Log request details
    request_id = request.json.get('request_id', f"req_{time.time()}_{os.urandom(4).hex()}")
    timestamp = request.json.get('timestamp', int(time.time() * 1000))
    logger.info(f"[ASK] Endpoint /ask dipanggil. Request ID: {request_id}, Timestamp: {timestamp}")
    
    # Log headers for debugging
    logger.info(f"[ASK] Request headers: {dict(request.headers)}")
    
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided", "request_id": request_id}), 400, response_headers

        sender = data.get('sender')
        message = data.get('message')
        sender_name = data.get('sender_name', sender.split('@')[0] if sender else "Unknown")

        if not sender or not message:
            return jsonify({"error": "Missing required fields", "request_id": request_id}), 400, response_headers

        # Log full request data for debugging
        logger.info(f"[ASK] Request data: {data}")
        
        # Import bot_status and unanswered_messages from admin_routes
        from admin_routes import bot_status, unanswered_messages
        
        # Check if bot is disabled for this sender
        if sender in bot_status and bot_status[sender] is False:
            # Bot is disabled, log the message but don't generate a response
            logger.info(f"Bot is disabled for {sender}. Message received but no response generated.")
            
            # Increment unanswered message count for this sender
            if sender in unanswered_messages:
                unanswered_messages[sender] += 1
            else:
                unanswered_messages[sender] = 1
            
            logger.info(f"Unanswered messages for {sender}: {unanswered_messages[sender]}")
            
            # Log the message with a manual response placeholder
            try:
                log_chat_message(
                    sender, 
                    sender_name, 
                    message, 
                    f"[Bot is disabled. This message is awaiting manual response from CS. ({unanswered_messages[sender]} unanswered)]" 
                )
                logger.info(f"Chat message logged for admin dashboard (bot disabled)")
            except Exception as log_error:
                logger.error(f"Error logging chat message: {str(log_error)}")
            
            # Return a special response indicating bot is disabled
            return jsonify({
                "response": None,
                "sender": sender,
                "bot_disabled": True,
                "unanswered_count": unanswered_messages[sender],
                "message": "Bot is disabled for this sender. Message logged for manual response.",
                "request_id": request_id,
                "timestamp": int(time.time() * 1000)
            }), 200, response_headers
        
        # Bot is enabled, proceed with OpenAI Assistant flow
        logger.info(f"[ASK] Mengirim ke Assistant API untuk nomor: {sender}, pesan: {message}")
        
        # Analyze message for insights
        try:
            analysis = analytics.analyze_chat_message(sender, message)
            logger.info(f"[ANALYTICS] Message analysis for {sender}: {analysis}")
            
            # Broadcast analytics update via WebSocket
            try:
                from websocket_handler import broadcast_analytics_update, broadcast_user_analytics_update
                
                # Broadcast user-specific analytics update
                broadcast_user_analytics_update(sender)
                
                # Broadcast overall analytics update
                user_insights = analytics.get_user_insights()
                broadcast_analytics_update('users', user_insights)
                
                logger.info(f"[WEBSOCKET] Broadcasted analytics update for {sender}")
            except Exception as ws_error:
                logger.error(f"[WEBSOCKET] Error broadcasting analytics update: {str(ws_error)}")
        except Exception as analysis_error:
            logger.error(f"[ANALYTICS] Error analyzing message: {str(analysis_error)}")
        
        # Verify API credentials before sending
        if not os.getenv('OPENAI_API_KEY'):
            logger.error("[ASK] OPENAI_API_KEY tidak ditemukan sebelum mengirim request")
            return jsonify({
                "error": "OpenAI API key tidak dikonfigurasi",
                "sender": sender
            }), 500
            
        if not os.getenv('OPENAI_ASSISTANT_ID'):
            logger.error("[ASK] OPENAI_ASSISTANT_ID tidak ditemukan sebelum mengirim request")
            return jsonify({
                "error": "OpenAI Assistant ID tidak dikonfigurasi",
                "sender": sender
            }), 500
            
        start_time = time.time()
        try:
            response = send_message_and_get_response(sender, message)
            if not response:
                logger.error("[ASK] Tidak ada respons dari OpenAI Assistant")
                return jsonify({
                    "error": "Tidak ada respons dari Assistant",
                    "sender": sender
                }), 500
        except Exception as e:
            logger.error(f"[ASK] Error saat memanggil OpenAI Assistant: {str(e)}")
            return jsonify({
                "error": f"Error saat memanggil Assistant: {str(e)}",
                "sender": sender
            }), 500
            
        response_time = time.time() - start_time
        logger.info(f"[ASK] Generated response for {sender_name} in {response_time:.2f} seconds: {response[:100]}...")
        
        # Log API performance
        analytics.log_api_performance(
            success=True,
            response_time=response_time
        )
        
        # Log the chat message for the admin dashboard
        try:
            log_chat_message(sender, sender_name, message, response, response_time)
            logger.info(f"Chat message logged for admin dashboard")
        except Exception as log_error:
            logger.error(f"Error logging chat message: {str(log_error)}")
        
        return jsonify({
            "response": response,
            "sender": sender,
            "response_time": round(response_time, 2),
            "request_id": request_id,
            "timestamp": int(time.time() * 1000)
        }), 200, response_headers
        
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        
        # Log API error
        analytics.log_api_performance(
            success=False,
            response_time=time.time() - start_time,
            error_message=str(e)
        )
        
        return jsonify({
            "response": "Maaf, terjadi kesalahan dalam memproses pertanyaan Anda. Silakan coba lagi nanti.",
            "sender": sender,
            "error_details": str(e)
        }), 500

@app.route('/feedback', methods=['POST'])
def feedback():
    """
    Optional endpoint to collect feedback on responses
    Expected request format:
    {
        "message_id": "unique_id",
        "rating": "thumbs_up" | "thumbs_down",
        "feedback": "Optional feedback text"
    }
    """
    try:
        data = request.json
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Here you would store the feedback for future model improvements
        logger.info(f"Received feedback: {data}")
        
        return jsonify({
            "status": "success",
            "message": "Feedback received"
        }), 200
        
    except Exception as e:
        logger.error(f"Error processing feedback: {str(e)}")
        return jsonify({
            "error": "An error occurred while processing your feedback",
            "details": str(e)
        }), 500

@app.route('/settings', methods=['GET'])
def get_chatbot_settings():
    """
    Get current chatbot settings
    """
    try:
        settings = get_settings()
        return jsonify(settings), 200
    except Exception as e:
        logger.error(f"Error getting settings: {str(e)}")
        return jsonify({"error": "Failed to get settings"}), 500

@app.route('/settings', methods=['POST'])
def update_chatbot_settings():
    """
    Update chatbot settings
    Expected request format:
    {
        "initialPrompt": "string",
        "maxTokens": number,
        "temperature": number,
        "modelName": "string"
    }
    """
    try:
        data = request.json
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Update settings
        success = update_settings(data)
        
        if success:
            # Update model name in RAG pipeline if it has changed
            if rag_pipeline and 'modelName' in data and hasattr(rag_pipeline, 'set_model'):
                rag_pipeline.set_model(data['modelName'])
            
            return jsonify({"message": "Settings updated successfully"}), 200
        else:
            return jsonify({"error": "Failed to update settings"}), 500
    except Exception as e:
        logger.error(f"Error updating settings: {str(e)}")
        return jsonify({"error": str(e)}), 500

# WhatsApp status endpoint
@app.route('/whatsapp/status', methods=['GET'])
def get_whatsapp_status_endpoint():
    """Get WhatsApp service status"""
    try:
        status = get_whatsapp_status()
        return jsonify(status), 200
    except Exception as e:
        logger.error(f"Error getting WhatsApp status: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Function to get WhatsApp service status
def get_whatsapp_status():
    """Get WhatsApp service status from the WhatsApp service"""
    try:
        # Get WhatsApp status from the WhatsApp service
        response = requests.get('http://localhost:3200/health', timeout=5)
        if response.status_code == 200:
            status_data = response.json()
            return status_data
        else:
            return {
                "status": "error",
                "message": f"WhatsApp service returned status code {response.status_code}",
                "error": True
            }
    except requests.exceptions.RequestException as e:
        logger.error(f"Error connecting to WhatsApp service: {str(e)}")
        return {
            "status": "error",
            "message": "Could not connect to WhatsApp service",
            "error": True
        }

# Endpoint to update WhatsApp status via WebSocket
@app.route('/whatsapp/status/update', methods=['POST'])
def update_whatsapp_status():
    """Update WhatsApp status and broadcast via WebSocket"""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        # Broadcast the status update via WebSocket
        broadcast_whatsapp_status_update(data)
        
        return jsonify({"success": True, "message": "Status broadcasted successfully"}), 200
    except Exception as e:
        logger.error(f"Error updating WhatsApp status: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Analytics endpoints
@app.route('/admin/analytics/users', methods=['GET', 'OPTIONS'])
def get_user_analytics():
    # Handle CORS preflight request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        return response
        
    try:
        insights = analytics.get_user_insights()
        logger.info(f'Raw user insights data: {insights}')
        
        if not insights or not isinstance(insights, dict):
            logger.error('Invalid insights data structure')
            return jsonify({
                'total_users': 0,
                'active_users': 0,
                'new_users': 0,
                'users': {}
            })
        
        # Tambahkan informasi selected_user ke response
        selected_user = user_preferences.get_selected_user()
        if selected_user:
            insights['selected_user'] = selected_user
        
        # Log successful response
        logger.info('Successfully retrieved user analytics data')
        return jsonify(insights)
    except Exception as e:
        logger.error(f'Error getting user analytics: {str(e)}')
        return jsonify({
            'total_users': 0,
            'active_users': 0,
            'new_users': 0,
            'users': {}
        }), 500

@app.route('/admin/analytics/performance', methods=['GET', 'OPTIONS'])
def get_performance_analytics():
    # Handle CORS preflight request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        return response
        
    try:
        days = request.args.get('days', default=7, type=int)
        metrics = analytics.get_performance_metrics(days)
        logger.info(f'Performance metrics for last {days} days: {metrics}')
        return jsonify(metrics)
    except Exception as e:
        logger.error(f'Error getting performance metrics: {str(e)}')
        return jsonify({
            'api_calls': 0,
            'total_response_time': 0,
            'average_response_time': 0,
            'success_rate': 0,
            'error_count': 0,
            'daily_metrics': {}
        }), 500

# Performance analytics endpoint is already defined above

# User preferences endpoints
@app.route('/admin/preferences/selected-user', methods=['GET', 'OPTIONS'])
def get_selected_user():
    # Handle CORS preflight request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        return response
    
    try:
        selected_user = user_preferences.get_selected_user()
        return jsonify({'selected_user': selected_user})
    except Exception as e:
        logger.error(f'Error getting selected user: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/admin/preferences/selected-user', methods=['POST', 'OPTIONS'])
def set_selected_user():
    # Handle CORS preflight request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        return response
    
    try:
        data = request.json
        if not data or 'selected_user' not in data:
            return jsonify({'error': 'Missing selected_user in request body'}), 400
        
        user_id = data['selected_user']
        success = user_preferences.set_selected_user(user_id)
        
        if success:
            # Broadcast update via WebSocket
            if socketio:
                socketio.emit('user_preference_update', {
                    'type': 'selected_user',
                    'selected_user': user_id
                })
            return jsonify({'success': True, 'selected_user': user_id})
        else:
            return jsonify({'error': 'Failed to save selected user'}), 500
    except Exception as e:
        logger.error(f'Error setting selected user: {str(e)}')
        return jsonify({'error': str(e)}), 500

# Thread messages endpoint
@app.route('/admin/threads/<path:sender>/messages', methods=['GET', 'OPTIONS'])
def get_thread_messages(sender):
    # Handle CORS preflight request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        # CORS headers are automatically added by Flask-CORS
        return response
        
    try:
        # Import here to avoid circular imports
        import requests
        from assistant_thread_manager import get_thread_id_for_nomor, get_all_threads
        from openai_assistant_pipeline import get_headers, OPENAI_API_URL
        
        logger.info(f'[Admin API] Mendapatkan thread messages untuk sender: {sender}')
        
        # Hapus karakter khusus dari sender jika ada
        cleaned_sender = sender.strip()
        
        # Get thread ID for the sender
        thread_id = get_thread_id_for_nomor(cleaned_sender)
        logger.info(f'[Admin API] Thread ID untuk {cleaned_sender}: {thread_id}')
        
        # Jika tidak ditemukan, coba cari dengan variasi format nomor
        if not thread_id:
            # Coba dengan dan tanpa @s.whatsapp.net
            alternative_sender = cleaned_sender
            if '@s.whatsapp.net' in cleaned_sender:
                alternative_sender = cleaned_sender.split('@')[0]
            else:
                alternative_sender = f'{cleaned_sender}@s.whatsapp.net'
                
            logger.info(f'[Admin API] Mencoba format alternatif: {alternative_sender}')
            thread_id = get_thread_id_for_nomor(alternative_sender)
            
            if thread_id:
                logger.info(f'[Admin API] Ditemukan thread dengan format alternatif: {thread_id}')
                cleaned_sender = alternative_sender
        
        # Jika masih tidak ditemukan, coba dengan prefix analytics_
        if not thread_id:
            logger.info(f'[Admin API] Mencoba dengan prefix analytics_')
            if not cleaned_sender.startswith('analytics_'):
                analytics_sender = f'analytics_{cleaned_sender}'
                thread_id = get_thread_id_for_nomor(analytics_sender)
                
                if thread_id:
                    logger.info(f'[Admin API] Ditemukan thread untuk {analytics_sender}: {thread_id}')
                    cleaned_sender = analytics_sender
            
            # Jika masih tidak ditemukan, coba dengan prefix analytics_ dan format alternatif
            if not thread_id and not cleaned_sender.startswith('analytics_'):
                if '@s.whatsapp.net' in cleaned_sender:
                    analytics_alt_sender = f'analytics_{cleaned_sender.split("@")[0]}'
                else:
                    analytics_alt_sender = f'analytics_{cleaned_sender}@s.whatsapp.net'
                    
                logger.info(f'[Admin API] Mencoba format analytics alternatif: {analytics_alt_sender}')
                thread_id = get_thread_id_for_nomor(analytics_alt_sender)
                
                if thread_id:
                    logger.info(f'[Admin API] Ditemukan thread dengan format analytics alternatif: {thread_id}')
                    cleaned_sender = analytics_alt_sender
        
        # Jika masih tidak ditemukan, tampilkan semua thread yang tersedia untuk debugging
        if not thread_id:
            all_threads = get_all_threads()
            logger.warning(f'[Admin API] Thread tidak ditemukan untuk {cleaned_sender}. Thread yang tersedia: {all_threads}')
            return jsonify({
                'error': 'Thread not found',
                'thread_id': '',
                'messages': [],
                'available_threads': list(all_threads.keys())
            }), 404
        
        # Get messages from OpenAI API
        headers = get_headers()
        logger.info(f'[Admin API] Mengambil pesan untuk thread {thread_id} (sender: {cleaned_sender})')
        
        try:
            response = requests.get(
                f"{OPENAI_API_URL}/threads/{thread_id}/messages",
                headers=headers,
                timeout=10
            )
            
            if response.status_code != 200:
                error_message = f'Error {response.status_code}: {response.text}'
                logger.error(f'[Admin API] {error_message}')
                
                # Coba sekali lagi dengan delay
                time.sleep(2)
                retry_response = requests.get(
                    f"{OPENAI_API_URL}/threads/{thread_id}/messages",
                    headers=headers,
                    timeout=10
                )
                
                if retry_response.status_code != 200:
                    logger.error(f'[Admin API] Gagal pada percobaan kedua: {retry_response.status_code}')
                    return jsonify({
                        'error': f'Failed to retrieve messages: {retry_response.status_code}',
                        'thread_id': thread_id,
                        'messages': []
                    }), 500
                else:
                    response = retry_response
                    logger.info(f'[Admin API] Berhasil mengambil pesan pada percobaan kedua')
            
            messages_data = response.json()
            message_count = len(messages_data.get("data", []))
            logger.info(f'[Admin API] Berhasil mengambil {message_count} pesan untuk thread {thread_id}')
            
            # Return the messages
            return jsonify({
                'thread_id': thread_id,
                'messages': messages_data.get('data', [])
            })
            
        except requests.exceptions.RequestException as e:
            logger.error(f'[Admin API] Request error: {str(e)}')
            return jsonify({
                'error': f'Request error: {str(e)}',
                'thread_id': thread_id,
                'messages': []
            }), 500
            
    except Exception as e:
        logger.error(f'[Admin API] Error retrieving thread messages: {str(e)}')
        return jsonify({
            'error': str(e),
            'thread_id': '',
            'messages': []
        }), 500

# Initialize WebSocket with CORS support
socketio = init_websocket(app)

# Import WebSocket handler functions
from websocket_handler import broadcast_whatsapp_status_update

# Import and set websocket handler in admin_routes and analytics
from admin_routes import set_websocket_handler
set_websocket_handler(socketio)

# Set WebSocket handler for analytics
analytics.websocket_handler = socketio
from admin_routes import set_websocket_handler
import websocket_handler
set_websocket_handler(websocket_handler)

# Register WebSocket event handlers
websocket_handler.register_handlers()

if __name__ == '__main__':
    # Configure logging
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger.setLevel(logging.DEBUG)
    
    # Configure CORS
    allowed_origins = ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"]
    logger.info(f"Allowing origins: {allowed_origins}")
    
    CORS(app, resources={
        r"/*": {
            "origins": allowed_origins,
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True,
            "expose_headers": ["Content-Type", "Authorization"]
        }
    })
    
    # Add CORS headers to all responses
    @app.after_request
    def after_request(response):
        origin = request.headers.get('Origin')
        if origin in allowed_origins:
            response.headers.add('Access-Control-Allow-Origin', origin)
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
            response.headers.add('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
        else:
            # For development, allow all origins if not in the allowed list
            response.headers.add('Access-Control-Allow-Origin', '*')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
            response.headers.add('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
        
        # Log the request and response for debugging
        logger.debug(f"Request: {request.method} {request.path} - Origin: {origin}")
        logger.debug(f"Response headers: {dict(response.headers)}")
        
        return response
    
    port = 5000
    debug = True
    
    logger.info(f"Starting RSH AI Backend on port {port} with WebSocket support")
    print(f"WebSocket URL: http://localhost:{port}")

    try:
        # Initialize Socket.IO first
        socketio = init_websocket(app)

        # Then run the server
        logger.info(f"Starting server on port {port}")
        socketio.run(app, host='0.0.0.0', port=port, debug=debug, allow_unsafe_werkzeug=True)
    except Exception as e:
        logger.error(f"Error starting server: {str(e)}")
        logger.error(traceback.format_exc())
        raise
