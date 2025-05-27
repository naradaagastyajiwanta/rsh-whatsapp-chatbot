import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import time
from dotenv import load_dotenv
from rag_pipeline import RAGPipeline
from mock_rag_pipeline import MockRAGPipeline
from openai_assistant_pipeline import send_message_and_get_response
from admin_routes import admin_bp, log_chat_message
from document_routes import document_bp
from chatbot_settings import get_settings, update_settings
from websocket_handler import init_websocket

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
CORS(app)  # Enable CORS for all routes

# Register blueprints
app.register_blueprint(admin_bp, url_prefix='/admin')
app.register_blueprint(document_bp, url_prefix='/document')

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
        "sender_name": "User Name" (optional)
    }
    """
    logger.info("[ASK] Endpoint /ask dipanggil. Menggunakan OpenAI Assistant API pipeline.")
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        sender = data.get('sender')
        message = data.get('message')
        sender_name = data.get('sender_name', sender.split('@')[0] if sender else "Unknown")

        if not sender or not message:
            return jsonify({"error": "Missing required fields"}), 400

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
                "message": "Bot is disabled for this sender. Message logged for manual response."
            }), 200
        
        # Bot is enabled, proceed with OpenAI Assistant flow
        logger.info(f"[ASK] Mengirim ke Assistant API untuk nomor: {sender}, pesan: {message}")
        
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
        
        # Log the chat message for the admin dashboard
        try:
            log_chat_message(sender, sender_name, message, response, response_time)
            logger.info(f"Chat message logged for admin dashboard")
        except Exception as log_error:
            logger.error(f"Error logging chat message: {str(log_error)}")
        
        return jsonify({
            "response": response,
            "sender": sender,
            "response_time": round(response_time, 2)
        }), 200
        
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
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

# Initialize WebSocket with CORS support
socketio = init_websocket(app)

# Import and set websocket handler in admin_routes
from admin_routes import set_websocket_handler
import websocket_handler
set_websocket_handler(websocket_handler)

# Register WebSocket event handlers
websocket_handler.register_handlers()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    debug = os.environ.get('FLASK_ENV', 'production') == 'development'
    
    logger.info(f"Starting RSH AI Backend on port {port} with WebSocket support")
    print(f"WebSocket URL: http://localhost:{port}")
    
    try:
        # Use socketio.run for WebSocket support
        logger.info("Using Socket.IO server")
        socketio.run(app, host='0.0.0.0', port=port, debug=debug, allow_unsafe_werkzeug=True)
    except Exception as e:
        logger.error(f"Error starting server with socketio.run: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        
        # Try alternative method if the first one fails
        try:
            logger.info("Falling back to Flask's built-in server")
            app.run(host='0.0.0.0', port=port, debug=debug)
        except Exception as e:
            logger.error(f"Error starting server with app.run: {str(e)}")
            logger.error(traceback.format_exc())
