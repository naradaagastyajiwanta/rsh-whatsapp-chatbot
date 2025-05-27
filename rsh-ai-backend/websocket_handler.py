import json
from flask import Flask
from flask_socketio import SocketIO, emit
from chat_logger import ChatLogger
from bot_manager import BotManager

# Create instances
chat_logger = ChatLogger()
bot_manager = BotManager()

# Initialize SocketIO
socketio = SocketIO()

def init_websocket(app: Flask):
    """Initialize WebSocket with the Flask app"""
    # Use async_mode='threading' to avoid issues with eventlet
    socketio.init_app(app, cors_allowed_origins="*", async_mode='threading')
    # Don't register handlers here to avoid circular imports
    return socketio

def register_handlers():
    """Register WebSocket event handlers"""
    
    @socketio.on('connect')
    def handle_connect(auth=None):
        print(f"Client connected with auth: {auth}")
        emit('connection_status', {'status': 'connected'})
        
        # Send initial chats data on connect
        chats = get_all_chats()
        print(f"Sending initial chats data: {len(chats)} chats")
        emit('chats_update', chats)
    
    @socketio.on('disconnect')
    def handle_disconnect():
        print("Client disconnected")
    
    @socketio.on('subscribe_to_chats')
    def handle_subscribe_to_chats():
        # Send initial chats data
        chats = get_all_chats()
        print(f"Client subscribed to chats, sending: {len(chats)} chats")
        emit('chats_update', chats)

def get_all_chats():
    """Get all chats formatted for frontend"""
    try:
        chats = chat_logger.get_all_chats()
        formatted_chats = []
        
        print(f"Formatting {len(chats)} chats for frontend")
        if not chats:
            print("Warning: No chats found in the database")
            return []
        
        for chat in chats:
            try:
                formatted_chat = format_chat_for_frontend(chat)
                
                # Add bot status
                chat_id = chat.get('id')
                if not chat_id:
                    print(f"Warning: Chat without ID found, skipping: {chat}")
                    continue
                    
                bot_enabled = bot_manager.is_bot_enabled(chat_id)
                formatted_chat['botEnabled'] = bot_enabled
                
                # Add unanswered count only if it's greater than 0
                try:
                    unanswered_count = chat_logger.get_unanswered_count(chat_id)
                    if unanswered_count > 0:
                        formatted_chat['unansweredCount'] = unanswered_count
                except Exception as e:
                    print(f"Error getting unanswered count for chat {chat_id}: {str(e)}")
                
                formatted_chats.append(formatted_chat)
            except Exception as e:
                print(f"Error formatting chat: {str(e)}")
                continue
        
        return formatted_chats
    except Exception as e:
        print(f"Error in get_all_chats: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return []

def broadcast_new_message(chat_id, message):
    """Broadcast a new message to all connected clients"""
    try:
        # Use the global chat_logger instance
        chat = chat_logger.get_chat(chat_id)
        
        if not chat:
            print(f"Warning: Chat {chat_id} not found for broadcasting")
            return
        
        # Format the chat for frontend
        formatted_chat = format_chat_for_frontend(chat)
        
        # Add bot status using the global bot_manager instance
        formatted_chat['botEnabled'] = bot_manager.is_bot_enabled(chat_id)
        
        # Add unanswered count
        try:
            unanswered_count = chat_logger.get_unanswered_count(chat_id)
            if unanswered_count > 0:
                formatted_chat['unansweredCount'] = unanswered_count
        except Exception as e:
            print(f"Error getting unanswered count: {str(e)}")
        
        # Ensure lastMessage and lastTimestamp are set correctly
        if chat.get('messages') and len(chat.get('messages')) > 0:
            last_msg = chat.get('messages')[-1]
            formatted_chat['lastMessage'] = last_msg.get('message', '') or last_msg.get('content', '')
            formatted_chat['lastTimestamp'] = last_msg.get('timestamp', '')
        
        # Log what we're sending
        print(f"Broadcasting new message for chat {chat_id}")
        print(f"lastMessage: {formatted_chat.get('lastMessage', '')}")
        print(f"lastTimestamp: {formatted_chat.get('lastTimestamp', '')}")
        
        # Broadcast the updated chat
        print(f"Emitting 'new_message' event with data: {formatted_chat}")
        socketio.emit('new_message', formatted_chat, broadcast=True)
        
        # Also broadcast updated chat list
        try:
            all_chats = get_all_chats()
            print(f"Broadcasting updated chat list: {len(all_chats)} chats")
            print(f"Emitting 'chats_update' event with {len(all_chats)} chats")
            socketio.emit('chats_update', all_chats, broadcast=True)
        except Exception as e:
            print(f"Error broadcasting chat list: {str(e)}")
    except Exception as e:
        print(f"Error in broadcast_new_message: {str(e)}")
        import traceback
        print(traceback.format_exc())

def broadcast_bot_status_change(chat_id, enabled):
    """Broadcast bot status change to all connected clients"""
    socketio.emit('bot_status_change', {
        'chatId': chat_id,
        'enabled': enabled
    })
    
    # Also broadcast updated chat list
    socketio.emit('chats_update', get_all_chats())

def broadcast_chats_update():
    """Broadcast updated chat list to all connected clients"""
    socketio.emit('chats_update', get_all_chats())

def format_chat_for_frontend(chat):
    """Format a chat object for the frontend"""
    # Get the last message for preview
    last_message = ''
    last_timestamp = ''
    if chat.get('messages') and len(chat.get('messages')) > 0:
        last_msg = chat.get('messages')[-1]
        last_message = last_msg.get('content', '') or last_msg.get('message', '')
        last_timestamp = last_msg.get('timestamp', '')
    
    # Format messages for the frontend
    formatted_messages = []
    for msg in chat.get('messages', []):
        # Handle both 'content' and 'message' fields for compatibility
        content = msg.get('content', '') or msg.get('message', '')
        
        formatted_messages.append({
            'id': msg.get('id'),
            'content': content,
            'timestamp': msg.get('timestamp', ''),
            'isFromUser': msg.get('is_from_user', True)
        })
        
        # If there's a response, add it as a separate message
        if msg.get('response'):
            formatted_messages.append({
                'id': f"{msg.get('id')}_response",
                'content': msg.get('response', ''),
                'timestamp': msg.get('timestamp', ''),
                'isFromUser': False
            })
    
    return {
        'id': chat.get('id'),
        'sender': chat.get('sender'),
        'senderName': chat.get('sender_name', ''),
        'lastMessage': last_message,
        'lastTimestamp': last_timestamp,
        'messages': formatted_messages
    }
