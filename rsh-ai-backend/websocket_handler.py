import json
import logging
import os
import traceback
from datetime import datetime
from flask import Flask, request
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
        
        # Konfigurasi Socket.IO yang sangat sederhana
        socketio = SocketIO(
            app,
            cors_allowed_origins="*",  # Izinkan semua origin
            async_mode='threading',
            logger=True,
            engineio_logger=True
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
            
            # Send individual updates
            emit('analytics:users', user_analytics)
            emit('analytics:performance', performance_metrics)
            
            # Also send in the legacy format for compatibility
            emit('analytics_update', {
                'type': 'users',
                'data': user_analytics
            })
            
            emit('analytics_update', {
                'type': 'performance',
                'data': performance_metrics
            })
            
            # Send combined data in one message
            emit('analytics_update', {
                'type': 'initial_data',
                'data': {
                    'users': user_analytics,
                    'performance': performance_metrics
                }
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
        
    @socketio.on('get_performance_metrics')
    def handle_get_performance_metrics():
        try:
            logger.info("Received get_performance_metrics event")
            performance_metrics = analytics.get_performance_metrics(7)
            logger.info(f"Sending performance metrics: {performance_metrics}")
            
            # Send using both event types for compatibility
            emit('analytics:performance', performance_metrics)
            emit('analytics_update', {
                'type': 'performance',
                'data': performance_metrics
            })
            
            logger.info("Successfully sent performance metrics")
        except Exception as e:
            logger.error(f"Error sending performance metrics: {str(e)}")
            logger.exception(e)
    
    @socketio.on('get_user_analytics')
    def handle_get_user_analytics():
        try:
            logger.info("Received get_user_analytics event")
            user_analytics = analytics.get_user_insights()
            logger.info(f"Sending user analytics with {len(user_analytics.get('users', {}))} users")
            
            # Send using both event types for compatibility
            emit('analytics:users', user_analytics)
            emit('analytics_update', {
                'type': 'users',
                'data': user_analytics
            })
            
            logger.info("Successfully sent user analytics")
        except Exception as e:
            logger.error(f"Error sending user analytics: {str(e)}")
            logger.exception(e)
    
    @socketio.on('subscribe_to_chats')
    def handle_subscribe_to_chats():
        # Send initial chats data
        chats = get_all_chats()
        print(f"Client subscribed to chats, sending: {len(chats)} chats")
        emit('chats_update', chats)
        
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
            
    @socketio.on('user_activity')
    def handle_user_activity(data):
        logger.info(f"Received user_activity event: {data}")
        try:
            if not data or not isinstance(data, dict) or 'user_id' not in data:
                logger.error(f"Invalid user_activity data: {data}")
                return
                
            user_id = data['user_id']
            timestamp = data.get('timestamp') or datetime.now().isoformat()
            activity_type = data.get('activity_type', 'message')
            
            # Update user insights file directly
            update_user_last_interaction(user_id, timestamp)
            
            # Broadcast the update to all connected clients
            broadcast_user_activity_update(user_id, timestamp, activity_type)
            
            logger.info(f"Successfully processed user_activity for {user_id}")
        except Exception as e:
            logger.error(f"Error processing user_activity: {str(e)}")
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
    broadcast_analytics_update('performance', metrics)

def broadcast_whatsapp_status_update(status_data):
    """Broadcast WhatsApp status update to all connected clients
    
    Args:
        status_data: WhatsApp status data to broadcast
    """
    try:
        if socketio:
            logger.info(f"Broadcasting WhatsApp status update: {status_data}")
            socketio.emit('whatsapp_status', status_data)
            return True
        return False
    except Exception as e:
        logger.error(f"Error broadcasting WhatsApp status update: {str(e)}")
        return False
        
def update_user_last_interaction(user_id, timestamp):
    """Update user's last_interaction timestamp in user_insights.json
    
    Args:
        user_id: The WhatsApp number of the user
        timestamp: The timestamp of the interaction
    """
    try:
        insights_file = os.path.join("analytics_data", "user_insights.json")
        
        # Ensure file exists
        if not os.path.exists(insights_file):
            logger.error(f"User insights file not found: {insights_file}")
            return False
        
        # Read current insights
        with open(insights_file, "r") as f:
            insights = json.load(f)
        
        # Update last_interaction timestamp
        if user_id in insights:
            # Update in details
            if 'details' in insights[user_id]:
                insights[user_id]['details']['last_interaction'] = timestamp
            
            # Add a new interaction entry
            if 'interactions' in insights[user_id]:
                # Get the latest analysis if available
                latest_analysis = insights[user_id].get('latest_analysis', {})
                if not latest_analysis and insights[user_id]['interactions']:
                    latest_analysis = insights[user_id]['interactions'][-1].get('analysis', {})
                
                # Add new interaction with timestamp
                insights[user_id]['interactions'].append({
                    "timestamp": timestamp,
                    "analysis": latest_analysis
                })
                
                # Limit to last 20 interactions to prevent file growth
                if len(insights[user_id]['interactions']) > 20:
                    insights[user_id]['interactions'] = insights[user_id]['interactions'][-20:]
            
            # Write updated insights back to file
            with open(insights_file, "w") as f:
                json.dump(insights, f, indent=2)
            
            logger.info(f"Updated last_interaction for {user_id} to {timestamp}")
            return True
        else:
            logger.warning(f"User {user_id} not found in insights file")
            return False
    except Exception as e:
        logger.error(f"Error updating user last_interaction: {str(e)}")
        logger.exception(e)
        return False

def broadcast_user_activity_update(user_id, timestamp, activity_type):
    """Broadcast user activity update to all connected clients
    
    Args:
        user_id: The WhatsApp number of the user
        timestamp: The timestamp of the activity
        activity_type: The type of activity (message, etc.)
    """
    try:
        if socketio:
            # Get updated user insights
            user_insights = analytics.get_user_insights(user_id)
            
            # Broadcast user_activity event
            activity_data = {
                'user_id': user_id,
                'timestamp': timestamp,
                'activity_type': activity_type
            }
            
            logger.info(f"Broadcasting user_activity update: {activity_data}")
            socketio.emit('user_activity', activity_data)
            
            # Also broadcast analytics update with full user data
            socketio.emit('analytics_update', {
                'type': 'user_insight_update',
                'data': {
                    'sender': user_id,
                    'details': user_insights.get('details', {}),
                    'latest_analysis': user_insights.get('latest_analysis', {})
                }
            })
            
            # Update the full users list
            all_user_insights = analytics.get_user_insights()
            socketio.emit('analytics_update', {
                'type': 'users',
                'data': all_user_insights
            })
            
            return True
        return False
    except Exception as e:
        logger.error(f"Error broadcasting user activity update: {str(e)}")
        logger.exception(e)
        return False

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
