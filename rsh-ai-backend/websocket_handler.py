import json
import logging
from flask import Flask
from flask_socketio import SocketIO, emit
from chat_logger import ChatLogger
from bot_manager import BotManager
from analytics_pipeline import analytics

logger = logging.getLogger(__name__)

# Create instances
chat_logger = ChatLogger()
bot_manager = BotManager()

# Initialize SocketIO
socketio = None

def init_websocket(app: Flask) -> SocketIO:
    """Initialize WebSocket with Flask app"""
    global socketio
    
    if socketio is not None:
        return socketio
        
    # Configure detailed logging
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger.setLevel(logging.DEBUG)
    
    try:
        # Create Socket.IO instance with the app directly
        # Allow all origins to fix CORS issues
        logger.info("Allowing all origins with cors_allowed_origins='*'")
        
        socketio = SocketIO(
            app,
            cors_allowed_origins="*",  # Allow all origins
            async_mode='threading',
            path='/socket.io',
            always_connect=True,
            ping_timeout=10000,  # Increased timeout
            ping_interval=25000,
            logger=True,
            engineio_logger=True,
            allow_upgrades=True,
            transports=['polling', 'websocket'],
            cors_credentials=True,
            manage_session=False  # Disable session management to avoid issues
        )
        
        logger.info('Socket.IO initialized successfully')
        register_handlers()
        
        return socketio
    except Exception as e:
        logger.error(f'Error initializing Socket.IO: {str(e)}')
        logger.error(f'Stack trace: {traceback.format_exc()}')
        raise

def register_handlers():
    """Register WebSocket event handlers"""
    
    @socketio.on('connect')
    def handle_connect(auth=None):
        logger.info(f'Client connected from {request.origin}')
        logger.debug(f'Connection details: {request.args}')
        # Send initial data
        try:
            emit_analytics_data()
            logger.info('Initial analytics data sent successfully')
        except Exception as e:
            logger.error(f'Error sending initial analytics data: {str(e)}')
        
        # Send initial chats data on connect
        chats = get_all_chats()
        logger.info(f"Sending initial chats data: {len(chats)} chats")
        emit('chats_update', chats)

    @socketio.on('disconnect')
    def handle_disconnect():
        logger.info('Client disconnected')
        
    @socketio.on_error()
    def error_handler(e):
        logger.error(f'SocketIO error: {str(e)}')
        logger.error(f'Stack trace: {traceback.format_exc()}')
        
    @socketio.on_error_default
    def default_error_handler(e):
        logger.error(f'Unhandled SocketIO error: {str(e)}')
        logger.error(f'Stack trace: {traceback.format_exc()}')
    
    @socketio.on('subscribe_to_analytics')
    def handle_subscribe_to_analytics():
        try:
            logger.info("Received subscribe_to_analytics event")
            
            # Send initial analytics data
            user_analytics = analytics.get_user_insights()
            performance_metrics = analytics.get_performance_metrics(7)
            
            logger.info(f"User analytics data: {user_analytics}")
            logger.info(f"Performance metrics: {performance_metrics}")
            
            emit('analytics_update', {
                'type': 'users',
                'data': user_analytics
            })
            
            emit('analytics_update', {
                'type': 'performance',
                'data': performance_metrics
            })
            
            logger.info("Successfully sent analytics data")
        except Exception as e:
            logger.error(f"Error sending initial analytics data: {str(e)}")
            logger.exception(e)
    
    @socketio.on('error')
    def handle_error(error):
        logger.error(f"Socket.IO error: {error}")
    
    @socketio.on('disconnect')
    def handle_disconnect():
        logger.info("Client disconnected")
    
    @socketio.on('subscribe_to_chats')
    def handle_subscribe_to_chats():
        # Send initial chats data
        chats = get_all_chats()
        print(f"Client subscribed to chats, sending: {len(chats)} chats")
        emit('chats_update', chats)
        
    @socketio.on('subscribe_to_analytics')
    def handle_subscribe_to_analytics():
        # Send initial analytics data
        user_analytics = analytics.get_user_insights()
        performance_metrics = analytics.get_performance_metrics(7)
        emit('analytics_update', {
            'type': 'initial_data',
            'data': {
                'users': user_analytics,
                'performance': performance_metrics
            }
        })
        
    @socketio.on('subscribe_to_whatsapp_status')
    def handle_subscribe_to_whatsapp_status():
        logger.info("Client subscribed to WhatsApp status updates")
        try:
            # Import the function to get WhatsApp status
            from app import get_whatsapp_status
            # Get current WhatsApp status
            status = get_whatsapp_status()
            # Send initial WhatsApp status
            emit('whatsapp_status', status)
            logger.info(f"Sent initial WhatsApp status: {status}")
        except Exception as e:
            logger.error(f"Error sending initial WhatsApp status: {str(e)}")
            logger.exception(e)

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
    chats = get_all_chats()
    socketio.emit('chats_update', chats)

def broadcast_analytics_update(update_type: str, data: dict):
    """Broadcast analytics update to all connected clients
    
    Args:
        update_type: Type of update ('user_insight', 'performance', etc)
        data: The update data to broadcast
    """
    # First broadcast the legacy format for compatibility
    socketio.emit('analytics_update', {
        'type': update_type,
        'data': data
    })
    
    # Also broadcast in the format expected by the frontend
    if update_type == 'user_insight_update' or update_type == 'users':
        logger.info(f"Broadcasting analytics:users event with {len(data.get('users', {})) if isinstance(data, dict) else 'N/A'} users")
        socketio.emit('analytics:users', data)
    elif update_type == 'performance':
        logger.info("Broadcasting analytics:performance event")
        socketio.emit('analytics:performance', data)

def broadcast_user_analytics_update(sender: str):
    """Broadcast updated user analytics for a specific sender
    
    Args:
        sender: The WhatsApp number of the user
    """
    user_data = analytics.get_user_insights(sender)
    if user_data:
        # Log the user data structure before broadcasting
        logger.info(f"Broadcasting user analytics update for {sender}")
        logger.info(f"User data contains {len(user_data.get('users', {}))} users")
        
        # Send directly to analytics:users for the frontend
        socketio.emit('analytics:users', user_data)
        
        # Also maintain backwards compatibility
        broadcast_analytics_update('user_insight_update', {
            'sender': sender,
            'data': user_data
        })

def broadcast_performance_metrics_update():
    """Broadcast updated performance metrics"""
    metrics = analytics.get_performance_metrics(7)
    broadcast_analytics_update('performance_update', metrics)

def broadcast_whatsapp_status_update(status_data):
    """Broadcast WhatsApp status update to all connected clients
    
    Args:
        status_data: WhatsApp status data to broadcast
    """
    try:
        print(f"Broadcasting WhatsApp status update: {status_data}")
        socketio.emit('whatsapp_status', status_data)
    except Exception as e:
        print(f"Error broadcasting WhatsApp status: {str(e)}")
        import traceback
        print(traceback.format_exc())

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
