"""
Admin dashboard API routes for the RSH WhatsApp Chatbot
"""
import os
import logging
import time
from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request
from chat_logger import ChatLogger
import time
import os
import uuid
from typing import Dict, Optional

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
        # Get the chat to find the sender
        chat = chat_logger.get_conversation(chat_id)
        if not chat:
            return jsonify({"error": "Chat not found"}), 404
        
        sender = chat["sender"]
        
        # Get bot status (default to True if not set)
        enabled = bot_status.get(sender, True)
        
        # Get unanswered message count (default to 0 if not set)
        unanswered_count = unanswered_messages.get(sender, 0)
        
        # Prepare response
        response_data = {
            "chatId": chat_id,
            "sender": sender,
            "botEnabled": enabled
        }
        
        # Only include unansweredCount if it's greater than 0
        if unanswered_count > 0:
            response_data["unansweredCount"] = unanswered_count
        
        return jsonify(response_data)
    except Exception as e:
        logger.error(f"Error getting bot status: {str(e)}")
        return jsonify({"error": f"Failed to get bot status: {str(e)}"}), 500

# Webhook to log messages from the WhatsApp service
@admin_bp.route('/log', methods=['POST'])
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
