"""
Admin dashboard API routes for the RSH WhatsApp Chatbot
"""
import os
import logging
import time
import json
from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request
from chat_logger import ChatLogger
import time
import os
import uuid
from typing import Dict, Optional
from analytics_pipeline import analytics

# Import WebSocket handler (will be imported when the blueprint is registered)
websocket_handler = None

# Configure logging
logger = logging.getLogger(__name__)

# Create a blueprint for admin routes
admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

# WebSocket handler
websocket_handler = None

def set_websocket_handler(handler):
    global websocket_handler
    websocket_handler = handler

# Initialize chat logger
chat_logger = ChatLogger()

# Dictionary to store bot status for each chat
# Default is True (bot is enabled)
bot_status: Dict[str, bool] = {}

# Dictionary to store unanswered messages for each sender
# Format: {sender_id: count_of_unanswered_messages}
unanswered_messages: Dict[str, int] = {}

# Initialize sample data for the chat logger
def initialize_sample_data():
    # Sample conversations
    sample_conversations = [
        {
            "sender": "6281234567890@s.whatsapp.net",
            "sender_name": "John Doe",
            "message": "Apa itu program 7 hari menuju sehat raga dan jiwa?",
            "response": "Program 7 Hari Menuju Sehat Raga & Jiwa adalah program intensif yang dirancang oleh RSH Satu Bumi untuk membantu Anda mencapai keseimbangan fisik dan mental dalam waktu singkat. Program ini mencakup kombinasi terapi holistik, pola makan sehat, meditasi, dan aktivitas fisik yang disesuaikan dengan kebutuhan individu."
        },
        {
            "sender": "6287654321098@s.whatsapp.net",
            "sender_name": "Jane Smith",
            "message": "Bagaimana cara mendaftar program ini?",
            "response": "Untuk mendaftar program 7 Hari Menuju Sehat Raga & Jiwa, Anda dapat menghubungi resepsionis RSH Satu Bumi di nomor 021-12345678 atau mengunjungi website kami di www.rshsatubumi.com/program-7hari. Tim kami akan membantu Anda dengan proses pendaftaran dan memberikan informasi lebih lanjut tentang jadwal dan persiapan yang diperlukan."
        },
        {
            "sender": "6282345678901@s.whatsapp.net",
            "sender_name": "Bob Johnson",
            "message": "Berapa biaya untuk mengikuti program detoksifikasi?",
            "response": "Biaya untuk program detoksifikasi di RSH Satu Bumi bervariasi tergantung pada durasi dan jenis program yang Anda pilih. Program detoksifikasi standar 3 hari dimulai dari Rp 5.000.000, sementara program 7 hari dimulai dari Rp 10.000.000. Biaya ini sudah termasuk akomodasi, makanan organik, terapi, dan konsultasi dengan dokter holistik. Untuk informasi lebih detail dan penawaran khusus, silakan hubungi tim layanan pelanggan kami."
        }
    ]
    
    # Check if we already have data
    conversations = chat_logger.get_conversations()
    if not conversations:
        # Log sample conversations
        for sample in sample_conversations:
            chat_logger.log_message(
                sender=sample["sender"],
                message=sample["message"],
                response=sample["response"],
                sender_name=sample["sender_name"],
                response_time=3.5
            )
            
        logger.info("Initialized sample chat data")

# Initialize sample data
initialize_sample_data()

# Function to log a new chat message
def log_chat_message(sender: str, sender_name: str, message: str, response: str, response_time: float = None):
    """
    Log a new chat message and its response
    
    Args:
        sender: Sender ID (WhatsApp number with @s.whatsapp.net)
        sender_name: Name of the sender
        message: User's message
        response: Bot's response
        response_time: Time taken to generate response in seconds
    """
    # Use the chat logger to log the message
    message_id = chat_logger.log_message(
        sender=sender,
        message=message,
        response=response,
        sender_name=sender_name,
        response_time=response_time
    )
    
    logger.info(f"Logged message from {sender}: {message[:50]}...")
    
    # Increment unanswered count if this is a user message without a response
    chat_id = chat_logger.get_chat_id_by_sender(sender)
    if message and not response and chat_id:
        if chat_id not in unanswered_messages:
            unanswered_messages[chat_id] = 0
        unanswered_messages[chat_id] += 1
    
    # Broadcast updates via WebSocket if available
    if websocket_handler and chat_id:
        try:
            logger.info(f"Broadcasting new message via WebSocket for chat {chat_id}")
            # Broadcast new message
            websocket_handler.broadcast_new_message(chat_id, message)
            # Broadcast updated chat list
            websocket_handler.broadcast_chats_update()
            
            # Broadcast user activity update to ensure new users are immediately visible
            current_time = datetime.now().isoformat()
            websocket_handler.broadcast_user_activity_update(sender, current_time, "message")
            
            # Also broadcast analytics update for this user to ensure new users appear in the list
            websocket_handler.broadcast_user_analytics_update(sender)
            
            logger.info("WebSocket broadcast completed successfully")
        except Exception as e:
            logger.error(f"Error broadcasting via WebSocket: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
    
    # No SSE broadcast needed, using WebSocket only

# Routes for the admin dashboard

@admin_bp.route('/chats', methods=['GET'])
def get_chats():
    """Get all chats"""
    limit = int(request.args.get('limit', 100))
    offset = int(request.args.get('offset', 0))
    conversations = chat_logger.get_conversations(limit=limit, offset=offset)
    
    # Format conversations for frontend
    formatted_conversations = []
    for conv in conversations:
        formatted_conv = {
            "id": conv["id"],
            "sender": conv["sender"],
            "senderName": conv["sender_name"],
            "lastMessage": conv["last_message"],
            "lastTimestamp": conv["last_timestamp"],
            "messages": []
        }
        
        # Format messages
        for msg in conv["messages"]:
            formatted_conv["messages"].append({
                "id": msg["id"],
                "content": msg["message"],
                "timestamp": msg["timestamp"],
                "isFromUser": True
            })
            formatted_conv["messages"].append({
                "id": f"{msg['id']}_response",
                "content": msg["response"],
                "timestamp": msg["timestamp"],
                "isFromUser": False
            })
            
        formatted_conversations.append(formatted_conv)
        
    return jsonify(formatted_conversations)

@admin_bp.route('/chats/<chat_id>', methods=['GET'])
def get_chat_by_id(chat_id):
    """Get a specific chat by ID"""
    conversation = chat_logger.get_conversation(chat_id)
    if not conversation:
        return jsonify({"error": "Chat not found"}), 404
        
    # Format conversation for frontend
    formatted_conv = {
        "id": conversation["id"],
        "sender": conversation["sender"],
        "senderName": conversation["sender_name"],
        "lastMessage": conversation["last_message"],
        "lastTimestamp": conversation["last_timestamp"],
        "messages": []
    }
    
    # Format messages
    for msg in conversation["messages"]:
        formatted_conv["messages"].append({
            "id": msg["id"],
            "content": msg["message"],
            "timestamp": msg["timestamp"],
            "isFromUser": True
        })
        formatted_conv["messages"].append({
            "id": f"{msg['id']}_response",
            "content": msg["response"],
            "timestamp": msg["timestamp"],
            "isFromUser": False
        })
        
    return jsonify(formatted_conv)

@admin_bp.route('/search', methods=['GET'])
def search_chats():
    """Search chats by query"""
    query = request.args.get('q', '')
    
    if not query:
        return get_chats()
    
    conversations = chat_logger.search_conversations(query)
    
    # Format conversations for frontend
    formatted_conversations = []
    for conv in conversations:
        formatted_conv = {
            "id": conv["id"],
            "sender": conv["sender"],
            "senderName": conv["sender_name"],
            "lastMessage": conv["last_message"],
            "lastTimestamp": conv["last_timestamp"],
            "messages": []
        }
        
        # Format messages
        for msg in conv["messages"]:
            if query.lower() in msg["message"].lower() or query.lower() in msg["response"].lower():
                formatted_conv["messages"].append({
                    "id": msg["id"],
                    "content": msg["message"],
                    "timestamp": msg["timestamp"],
                    "isFromUser": True
                })
                formatted_conv["messages"].append({
                    "id": f"{msg['id']}_response",
                    "content": msg["response"],
                    "timestamp": msg["timestamp"],
                    "isFromUser": False
                })
            
        formatted_conversations.append(formatted_conv)
        
    return jsonify(formatted_conversations)

@admin_bp.route('/stats', methods=['GET'])
def get_stats():
    """Get chat statistics"""
    stats = chat_logger.get_stats()
    return jsonify(stats)

@admin_bp.route('/send-message', methods=['POST'])
def send_message():
    """Send a message to a recipient via WhatsApp"""
    data = request.json
    
    if not data or 'recipient' not in data or 'message' not in data:
        return jsonify({"error": "Missing required fields"}), 400
    
    recipient = data['recipient']
    admin_message = data['message']
    use_bot = data.get('useBot', True)
    
    try:
        # Store bot status for this recipient
        bot_status[recipient] = use_bot
        
        # Reset unanswered message count when admin sends a message
        # Always set to 0 regardless of whether it existed before
        if recipient in unanswered_messages and unanswered_messages[recipient] > 0:
            logger.info(f"Resetting unanswered message count for {recipient} (was {unanswered_messages[recipient]})")
        unanswered_messages[recipient] = 0
        
        # Implement actual message sending to WhatsApp
        try:
            # Import the WhatsApp service module
            from whatsapp_service import send_whatsapp_message
            
            # Send message via WhatsApp
            whatsapp_result = send_whatsapp_message(recipient, admin_message)
            logger.info(f"Message sent to WhatsApp: {whatsapp_result}")
        except ImportError:
            logger.warning("WhatsApp service module not found. Creating a mock implementation.")
            
            # Create a mock implementation if the WhatsApp service is not available
            logger.info(f"[MOCK] Message would be sent to {recipient}: {admin_message}")
            whatsapp_result = {"status": "sent", "message_id": str(uuid.uuid4())}
        
        # Create a mock user message to simulate a conversation
        # In a real scenario, we wouldn't need this - we'd just send our message
        mock_user_message = "[This is a placeholder for user's previous message]"
        
        # Log the message - here admin_message is the RESPONSE (from chatbot/admin perspective)
        # and mock_user_message is the user's message
        message_id = chat_logger.log_message(
            sender=recipient,
            message=mock_user_message,  # This would be the actual user message in a real scenario
            response=admin_message,     # Admin message is the response from chatbot/CS perspective
            sender_name=None,           # We don't have this info when admin sends message
            response_time=0.1           # Mock response time
        )
        
        # Get chat ID for WebSocket broadcast
        chat_id = chat_logger.get_chat_id_by_sender(recipient)
        
        # Broadcast updates via WebSocket if available
        if websocket_handler and chat_id:
            # Broadcast new message
            websocket_handler.broadcast_new_message(chat_id, admin_message)
            # Broadcast updated chat list
            websocket_handler.broadcast_chats_update()
        
        return jsonify({
            "success": True,
            "message": "Message sent successfully",
            "messageId": message_id,
            "whatsappResult": whatsapp_result
        })
    except Exception as e:
        logger.error(f"Error sending message: {str(e)}")
        return jsonify({"error": f"Failed to send message: {str(e)}"}), 500

@admin_bp.route('/toggle-bot/<chat_id>', methods=['POST'])
def toggle_bot(chat_id):
    """Toggle bot status for a specific chat"""
    data = request.json
    
    if not data or 'enabled' not in data:
        return jsonify({"error": "Missing 'enabled' field"}), 400
    
    enabled = data['enabled']
    
    try:
        # Get the chat to find the sender
        chat = chat_logger.get_conversation(chat_id)
        if not chat:
            return jsonify({"error": "Chat not found"}), 404
        
        sender = chat["sender"]
        
        # Update bot status
        bot_status[sender] = enabled
        
        # Broadcast bot status change via WebSocket if available
        if websocket_handler:
            try:
                websocket_handler.broadcast_bot_status_change(chat_id, enabled)
            except Exception as e:
                logger.error(f"Error broadcasting bot status change via WebSocket: {str(e)}")
        
        # No SSE broadcast needed, using WebSocket only
        
        # Broadcast chats update via WebSocket if available
        if websocket_handler:
            websocket_handler.broadcast_chats_update()
        
        return jsonify({
            "success": True,
            "chatId": chat_id,
            "sender": sender,
            "botEnabled": enabled
        })
    except Exception as e:
        logger.error(f"Error toggling bot status: {str(e)}")
        return jsonify({"error": f"Failed to toggle bot status: {str(e)}"}), 500

@admin_bp.route('/bot-status/<chat_id>', methods=['GET'])
def get_bot_status(chat_id):
    """Get bot status for a specific chat"""
    try:
        logger.info(f"Getting bot status for chat_id: {chat_id}")
        
        # Get the chat to find the sender
        # Mencoba menggunakan get_conversation terlebih dahulu
        chat = chat_logger.get_conversation(chat_id)
        
        # Jika tidak ditemukan, coba gunakan get_chat sebagai fallback
        if not chat:
            logger.warning(f"Chat not found with get_conversation, trying get_chat for chat_id: {chat_id}")
            chat = chat_logger.get_chat(chat_id)
            
        if not chat:
            logger.error(f"Chat not found for chat_id: {chat_id}")
            return jsonify({"error": "Chat not found"}), 404
        
        logger.info(f"Chat found: {chat['id']}")
        sender = chat["sender"]
        logger.info(f"Sender: {sender}")
        
        # Get bot status (default to True if not set)
        enabled = bot_status.get(sender, True)
        logger.info(f"Bot enabled for {sender}: {enabled}")
        
        # Get unanswered message count using chat_logger method
        try:
            unanswered_count = chat_logger.get_unanswered_count(chat_id)
            logger.info(f"Unanswered count for {chat_id}: {unanswered_count}")
        except Exception as e:
            logger.error(f"Error getting unanswered count: {str(e)}")
            unanswered_count = 0
        
        # Prepare response
        response_data = {
            "chatId": chat_id,
            "sender": sender,
            "botEnabled": enabled,
            "unansweredCount": unanswered_count  # Selalu sertakan unansweredCount
        }
        
        logger.info(f"Returning bot status response: {response_data}")
        return jsonify(response_data)
    except Exception as e:
        logger.error(f"Error getting bot status for {chat_id}: {str(e)}")
        return jsonify({"error": f"Failed to get bot status: {str(e)}"}), 500

# Clear all assistant threads
@admin_bp.route('/clear-threads', methods=['POST'])
def clear_threads():
    try:
        from assistant_thread_manager import clear_all_threads
        clear_all_threads()
        logger.info("[ADMIN] Berhasil membersihkan semua thread assistant")
        return jsonify({
            "status": "success",
            "message": "Semua thread assistant berhasil dibersihkan"
        }), 200
    except Exception as e:
        logger.error(f"[ADMIN] Error saat membersihkan thread: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Error saat membersihkan thread: {str(e)}"
        }), 500

# Delete thread for a specific user
@admin_bp.route('/delete-thread/<phone_number>', methods=['DELETE'])
def delete_thread(phone_number):
    try:
        # Import the thread manager
        from assistant_thread_manager import delete_thread_for_nomor
        # Import analytics pipeline for analytics data deletion
        from analytics_pipeline import analytics
        
        # Normalize the phone number
        phone_number = phone_number.strip()
        
        # Delete the thread
        thread_success = delete_thread_for_nomor(phone_number)
        
        # Delete associated analytics data
        analytics_success = False
        analytics_message = ""
        try:
            analytics_success = analytics.delete_user_insights(phone_number)
            if analytics_success:
                analytics_message = "and associated analytics data "
                logger.info(f"[ADMIN] Successfully deleted analytics data for {phone_number}")
            else:
                analytics_message = "but no analytics data found "
                logger.warning(f"[ADMIN] No analytics data found for {phone_number}")
        except Exception as analytics_error:
            analytics_message = "but failed to delete analytics data "
            logger.error(f"[ADMIN] Error deleting analytics data: {str(analytics_error)}")
        
        if thread_success:
            logger.info(f"[ADMIN] Successfully deleted thread {analytics_message}for {phone_number}")
            
            # Broadcast thread deletion via WebSocket if available
            if websocket_handler:
                websocket_handler.broadcast_event('thread_deleted', {
                    'phone_number': phone_number,
                    'analytics_deleted': analytics_success,
                    'timestamp': datetime.utcnow().isoformat(),
                    'status': 'success'
                })
            
            return jsonify({
                "status": "success",
                "message": f"Thread {analytics_message}for {phone_number} successfully deleted",
                "analytics_deleted": analytics_success
            }), 200
        else:
            logger.warning(f"[ADMIN] No thread found for {phone_number} to delete")
            return jsonify({
                "status": "warning",
                "message": f"No thread found for {phone_number}"
            }), 404
    except Exception as e:
        logger.error(f"[ADMIN] Error deleting thread: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Error deleting thread: {str(e)}"
        }), 500

# Analytics endpoints
@admin_bp.route('/analytics/performance', methods=['GET'])
def get_performance_analytics():
    try:
        days = request.args.get('days', default=7, type=int)
        metrics = analytics.get_performance_metrics(days)
        return jsonify(metrics), 200
    except Exception as e:
        logger.error(f"Error getting performance analytics: {str(e)}")
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/analytics/users', methods=['GET'])
def get_user_analytics():
    try:
        sender = request.args.get('sender', default=None)
        logger.info(f"Fetching user analytics data for sender: {sender}")
        
        insights = analytics.get_user_insights(sender)
        
        # Log the structure to help diagnose issues
        users_count = len(insights.get('users', {}))
        logger.info(f"Sending user analytics response with {users_count} users")
        logger.info(f"Response structure: {list(insights.keys())}")
        
        # Ensure the response has the expected structure
        if 'users' not in insights or not isinstance(insights['users'], dict):
            logger.warning(f"Users data structure is not correct: {type(insights.get('users'))}")
            insights['users'] = insights.get('users', {})
            
        # Return properly formatted JSON response with correct content type
        response = jsonify(insights)
        response.headers['Content-Type'] = 'application/json'
        return response, 200
    except Exception as e:
        logger.error(f"Error getting user analytics: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e), "type": "analytics_error"}), 500

@admin_bp.route('/analytics/users/<sender>/history', methods=['GET'])
def get_user_analytics_history(sender):
    try:
        insights = analytics.get_user_insights(sender)
        if not insights:
            return jsonify({"error": "User not found"}), 404
        return jsonify(insights), 200
    except Exception as e:
        logger.error(f"Error getting user history: {str(e)}")
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/user-history/<sender>', methods=['GET'])
def get_user_history(sender):
    try:
        # Get conversation for this sender
        conversation = chat_logger.get_chat(f"conv_{sender.split('@')[0]}")
        
        if not conversation:
            return jsonify({
                "success": False,
                "error": "Conversation not found"
            }), 404
            
        return jsonify({
            "success": True,
            "conversation": conversation
        })
    except Exception as e:
        logger.error(f"Error getting user history: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@admin_bp.route('/user-messages/<phone_number>', methods=['GET'])
def get_user_messages(phone_number):
    try:
        # Format the phone number to match the expected format in the database
        if '@s.whatsapp.net' not in phone_number:
            sender = f"{phone_number}@s.whatsapp.net"
        else:
            sender = phone_number
            
        # Get conversation for this sender
        conversation = chat_logger.get_chat(f"conv_{sender.split('@')[0]}")
        
        if not conversation:
            return jsonify({
                "success": False,
                "error": "Conversation not found"
            }), 404
            
        # Extract only the messages sent by the user
        user_messages = []
        for message in conversation.get("messages", []):
            # In our data structure, messages from the user don't have a 'response' field
            # as their own property, they are the 'message' field
            if "message" in message:
                user_messages.append(message["message"])
            
        return jsonify({
            "success": True,
            "messages": user_messages
        })
    except Exception as e:
        logger.error(f"Error getting user messages: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

# User preferences endpoints
@admin_bp.route('/preferences/selected-user', methods=['GET', 'POST', 'OPTIONS'])
@admin_bp.route('/preferences/selected_user', methods=['GET', 'POST', 'OPTIONS'])  # Support both dash and underscore
def selected_user_endpoint():
    # Handle CORS preflight request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,pragma,cache-control')
        response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    
    # Path untuk file preferences
    preferences_path = os.path.join('analytics_data', 'user_preferences.json')
    
    # Pastikan direktori ada
    os.makedirs('analytics_data', exist_ok=True)
    
    # GET request - mengembalikan selected user yang tersimpan
    if request.method == 'GET':
        try:
            logger.info(f"Received GET to /admin/preferences/selected-user")
            
            # Baca file preferences jika ada
            if os.path.exists(preferences_path):
                try:
                    with open(preferences_path, 'r') as f:
                        preferences = json.load(f)
                        selected_user = preferences.get('selected_user', '')
                        logger.info(f"Returning selected_user: {selected_user}")
                except Exception as read_error:
                    logger.error(f"Error reading preferences file: {str(read_error)}")
                    selected_user = ''
            else:
                logger.info("Preferences file doesn't exist, returning empty selected_user")
                selected_user = ''
                
                # Buat file kosong jika belum ada
                with open(preferences_path, 'w') as f:
                    json.dump({'selected_user': '', 'admin_preferences': {}}, f, indent=2)
            
            # Buat response dengan header CORS
            response = jsonify({'selected_user': selected_user})
            response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response
            
        except Exception as e:
            logger.error(f"Error in GET selected_user: {str(e)}")
            response = jsonify({'error': str(e)})
            response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response, 500
    
    # POST request - menyimpan selected user
    elif request.method == 'POST':
        try:
            # Log request info
            logger.info(f"Received POST to /admin/preferences/selected-user")
            logger.info(f"Request content type: {request.content_type}")
            logger.info(f"Request data: {request.data}")
            
            # Parse JSON data dengan silent=True untuk menghindari error
            data = request.get_json(silent=True)
            if not data:
                logger.error("Failed to parse JSON or empty data received")
                response = jsonify({'error': 'Invalid JSON format or empty data'})
                response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
                response.headers.add('Access-Control-Allow-Credentials', 'true')
                return response, 400
                
            logger.info(f"Parsed JSON data: {data}")
            
            # Validasi data
            if 'selected_user' not in data:
                logger.error("Missing selected_user field in request")
                response = jsonify({'error': 'Missing selected_user field'})
                response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
                response.headers.add('Access-Control-Allow-Credentials', 'true')
                return response, 400
                
            selected_user = data['selected_user']
            logger.info(f"Selected user to save: {selected_user}")
            
            # Validasi format nomor telepon (opsional)
            if selected_user and not selected_user.endswith('@s.whatsapp.net'):
                logger.info(f"Adding @s.whatsapp.net suffix to {selected_user}")
                selected_user = f"{selected_user}@s.whatsapp.net"
            
            # Pastikan direktori analytics_data ada
            if not os.path.exists('analytics_data'):
                logger.info("Creating analytics_data directory")
                os.makedirs('analytics_data', exist_ok=True)
            
            # Baca file preferences yang sudah ada jika tersedia
            preferences = {'admin_preferences': {}}
            if os.path.exists(preferences_path):
                try:
                    with open(preferences_path, 'r') as file:
                        preferences = json.load(file)
                except Exception as read_error:
                    logger.warning(f"Error reading preferences file, creating new one: {str(read_error)}")
            
            # Update preferences dengan selected_user baru
            preferences['selected_user'] = selected_user
            
            # Simpan ke file dengan error handling
            try:
                with open(preferences_path, 'w') as file:
                    json.dump(preferences, file, indent=2)
                logger.info(f"Successfully saved selected_user: {selected_user}")
            except Exception as write_error:
                logger.error(f"Error writing preferences file: {str(write_error)}")
                response = jsonify({'error': f'Failed to save preferences: {str(write_error)}'})
                response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
                response.headers.add('Access-Control-Allow-Credentials', 'true')
                return response, 500
            
            # Return success response dengan header CORS
            response = jsonify({'success': True, 'selected_user': selected_user})
            response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response
                
        except Exception as e:
            # Log error dan kirim response error dengan header CORS
            logger.error(f"Error in POST selected_user: {str(e)}")
            response = jsonify({'error': str(e)})
            response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response, 500

# Thread messages endpoints
@admin_bp.route('/threads/<path:sender>/messages', methods=['GET', 'OPTIONS'])
@admin_bp.route('/thread-messages/<path:sender>', methods=['GET', 'OPTIONS'])
def get_thread_messages(sender):
    # Handle CORS preflight request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,pragma,cache-control')
        response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
        
    try:
        # Import here to avoid circular imports
        import requests
        import json
        from assistant_thread_manager import get_thread_id_for_nomor, get_all_threads
        from openai_assistant_pipeline import get_headers, OPENAI_API_URL
        
        logger.info(f'[Admin API] Mendapatkan thread messages untuk sender: {sender}')
        
        # Hapus karakter khusus dari sender jika ada
        cleaned_sender = sender.strip()
        logger.info(f'[Admin API] Mencari thread messages untuk sender: {cleaned_sender}')
        
        # Gunakan fungsi get_thread_id_for_nomor yang sudah ditingkatkan
        # Fungsi ini akan mencoba berbagai format nomor dan menambahkan logging
        thread_id = get_thread_id_for_nomor(cleaned_sender)
        
        # Log semua thread yang tersedia untuk debugging
        all_threads = get_all_threads()
        logger.info(f'[Admin API] Thread yang tersedia: {list(all_threads.keys())}')
        logger.info(f'[Admin API] Thread ID yang ditemukan: {thread_id}')
        
        # Tambahkan informasi tentang selected_user yang disimpan
        try:
            preferences_path = os.path.join('analytics_data', 'user_preferences.json')
            if os.path.exists(preferences_path):
                with open(preferences_path, 'r') as f:
                    preferences = json.load(f)
                    selected_user = preferences.get('selected_user', '')
                    logger.info(f'[Admin API] Selected user dari preferences: {selected_user}')
                    logger.info(f'[Admin API] Apakah sama dengan sender? {selected_user == cleaned_sender}')
        except Exception as e:
            logger.error(f'[Admin API] Error saat membaca preferences: {str(e)}')
            
        # Log informasi tambahan untuk membantu debugging
        logger.info(f'[Admin API] Sender yang diterima: {sender}')
        logger.info(f'[Admin API] Cleaned sender: {cleaned_sender}')
        if '@s.whatsapp.net' in cleaned_sender:
            logger.info(f'[Admin API] Base nomor: {cleaned_sender.split("@")[0]}')
        else:
            logger.info(f'[Admin API] Nomor dengan suffix: {cleaned_sender}@s.whatsapp.net')
        
        # Jika masih tidak ditemukan, coba cari thread yang paling cocok dari semua thread yang tersedia
        if not thread_id:
            all_threads = get_all_threads()
            logger.warning(f'[Admin API] Thread tidak ditemukan untuk {cleaned_sender}. Thread yang tersedia: {all_threads}')
            
            # Coba cari thread yang paling cocok berdasarkan substring matching
            base_number = cleaned_sender.split('@')[0] if '@' in cleaned_sender else cleaned_sender
            logger.info(f'[Admin API] Mencoba mencari thread berdasarkan substring: {base_number}')
            
            matching_threads = {}
            for thread_key, thread_val in all_threads.items():
                # Bandingkan tanpa @s.whatsapp.net dan tanpa prefix analytics_
                thread_base = thread_key.split('@')[0] if '@' in thread_key else thread_key
                thread_base = thread_base.replace('analytics_', '')
                
                # Jika nomor base ada dalam thread key atau sebaliknya
                if base_number in thread_base or thread_base in base_number:
                    matching_score = len(set(base_number) & set(thread_base)) / max(len(base_number), len(thread_base))
                    matching_threads[thread_key] = (thread_val, matching_score)
                    logger.info(f'[Admin API] Menemukan thread yang cocok: {thread_key} dengan skor: {matching_score}')
            
            # Jika ada thread yang cocok, gunakan yang paling cocok
            if matching_threads:
                best_match = max(matching_threads.items(), key=lambda x: x[1][1])
                thread_key, (thread_val, _) = best_match
                thread_id = thread_val
                logger.info(f'[Admin API] Menggunakan thread terbaik: {thread_key} -> {thread_id}')
            else:
                # Jika tidak ada yang cocok, kembalikan error
                response = jsonify({
                    'error': 'Thread not found',
                    'thread_id': '',
                    'messages': [],
                    'available_threads': list(all_threads.keys())
                })
                response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
                response.headers.add('Access-Control-Allow-Credentials', 'true')
                return response, 404
        
        # Get messages from OpenAI API
        if thread_id:
            url = f"{OPENAI_API_URL}/threads/{thread_id}/messages"
            headers = get_headers()
            
            logger.info(f'[Admin API] Mengambil pesan dari thread: {thread_id}')
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                messages = data.get('data', [])
                
                # Format messages for frontend
                formatted_messages = []
                for msg in messages:
                    role = msg.get('role', '')
                    content = msg.get('content', [])
                    
                    # Extract text content
                    text_content = ""
                    for content_item in content:
                        if content_item.get('type') == 'text':
                            text_content = content_item.get('text', {}).get('value', '')
                    
                    formatted_messages.append({
                        'id': msg.get('id', ''),
                        'role': role,
                        'content': text_content,
                        'created_at': msg.get('created_at', 0)
                    })
                
                # Sort messages by created_at (newest first)
                formatted_messages.sort(key=lambda x: x['created_at'], reverse=True)
                
                logger.info(f'[Admin API] Berhasil mengambil {len(formatted_messages)} pesan')
                
                # Return messages with CORS headers
                response = jsonify({
                    'thread_id': thread_id,
                    'messages': formatted_messages
                })
                response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
                response.headers.add('Access-Control-Allow-Credentials', 'true')
                return response
            else:
                logger.error(f'[Admin API] Error dari OpenAI API: {response.status_code} {response.text}')
                response = jsonify({
                    'error': f'Error from OpenAI API: {response.status_code}',
                    'thread_id': thread_id,
                    'messages': []
                })
                response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
                response.headers.add('Access-Control-Allow-Credentials', 'true')
                return response, response.status_code
        else:
            logger.error(f'[Admin API] Thread tidak ditemukan untuk {cleaned_sender}')
            response = jsonify({
                'error': 'Thread not found',
                'thread_id': '',
                'messages': []
            })
            response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response, 404
            
    except Exception as e:
        logger.error(f'[Admin API] Error saat mengambil thread messages: {str(e)}')
        import traceback
        logger.error(traceback.format_exc())
        response = jsonify({
            'error': str(e),
            'thread_id': '',
            'messages': []
        })
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 500

# Webhook to log messages from the WhatsApp service
@admin_bp.route('/log-message', methods=['POST'])
def log_message():
    data = request.json
    
    if not data or 'sender' not in data or 'message' not in data or 'response' not in data:
        return jsonify({"error": "Invalid request data"}), 400
        
    sender = data['sender']
    message = data['message']
    response = data['response']
    sender_name = data.get('sender_name', sender.split('@')[0])
    response_time = data.get('response_time')
    
    log_chat_message(sender, sender_name, message, response, response_time)
    
    return jsonify({"success": True})
