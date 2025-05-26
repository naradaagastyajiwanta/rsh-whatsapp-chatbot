import os
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

class ChatLogger:
    """
    Class to handle logging and retrieving chat messages for analytics and monitoring.
    """
    def __init__(self, log_dir: str = "chat_logs"):
        """
        Initialize the ChatLogger.
        
        Args:
            log_dir: Directory to store chat logs
        """
        self.log_dir = log_dir
        
        # Create log directory if it doesn't exist
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)
            
        # Create conversations file if it doesn't exist
        self.conversations_file = os.path.join(log_dir, "conversations.json")
        if not os.path.exists(self.conversations_file):
            with open(self.conversations_file, "w") as f:
                json.dump([], f)
                
        # Create stats file if it doesn't exist
        self.stats_file = os.path.join(log_dir, "stats.json")
        if not os.path.exists(self.stats_file):
            with open(self.stats_file, "w") as f:
                json.dump({
                    "total_messages": 0,
                    "total_conversations": 0,
                    "unique_users": 0,
                    "response_times": []
                }, f)
    
    def log_message(self, 
                   sender: str, 
                   message: str, 
                   response: str, 
                   sender_name: Optional[str] = None,
                   response_time: Optional[float] = None,
                   metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Log a message and its response.
        
        Args:
            sender: Sender ID (usually WhatsApp number with @s.whatsapp.net)
            message: User's message
            response: Bot's response
            sender_name: Name of the sender (if available)
            response_time: Time taken to generate response in seconds
            metadata: Additional metadata about the message
            
        Returns:
            message_id: Unique ID for the message
        """
        timestamp = datetime.now().isoformat()
        message_id = f"{sender.split('@')[0]}_{int(datetime.now().timestamp())}"
        
        # Create message object
        message_obj = {
            "id": message_id,
            "sender": sender,
            "sender_name": sender_name or sender.split('@')[0],
            "message": message,
            "response": response,
            "timestamp": timestamp,
            "response_time": response_time
        }
        
        if metadata:
            message_obj["metadata"] = metadata
            
        # Load existing conversations
        conversations = self._load_conversations()
        
        # Check if conversation with this sender already exists
        conversation_exists = False
        for conversation in conversations:
            if conversation["sender"] == sender:
                conversation_exists = True
                conversation["messages"].append(message_obj)
                conversation["last_message"] = message
                conversation["last_timestamp"] = timestamp
                break
                
        # If no conversation exists, create a new one
        if not conversation_exists:
            conversations.append({
                "id": f"conv_{sender.split('@')[0]}",
                "sender": sender,
                "sender_name": sender_name or sender.split('@')[0],
                "messages": [message_obj],
                "first_timestamp": timestamp,
                "last_timestamp": timestamp,
                "last_message": message
            })
            
        # Save conversations
        self._save_conversations(conversations)
        
        # Update stats
        self._update_stats(sender, response_time)
        
        return message_id
    
    def get_conversations(self, limit: int = 100, offset: int = 0) -> List[Dict]:
        """
        Get a list of conversations.
        
        Args:
            limit: Maximum number of conversations to return
            offset: Number of conversations to skip
            
        Returns:
            List of conversation objects
        """
        conversations = self._load_conversations()
        
        # Sort by last_timestamp (newest first)
        conversations.sort(key=lambda x: x["last_timestamp"], reverse=True)
        
        return conversations[offset:offset+limit]
    
    def get_conversation(self, conversation_id: str) -> Optional[Dict]:
        """
        Get a specific conversation by ID.
        
        Args:
            conversation_id: ID of the conversation
            
        Returns:
            Conversation object or None if not found
        """
        conversations = self._load_conversations()
        
        for conversation in conversations:
            if conversation["id"] == conversation_id:
                return conversation
                
        return None
    
    def get_stats(self) -> Dict:
        """
        Get chat statistics.
        
        Returns:
            Dictionary with chat statistics
        """
        # Load stats
        with open(self.stats_file, "r") as f:
            stats = json.load(f)
            
        # Calculate derived stats
        today = datetime.now().date()
        this_week_start = today.replace(day=today.day - today.weekday())
        
        # Load conversations to calculate today's and this week's stats
        conversations = self._load_conversations()
        
        # Count messages today and this week
        total_today = 0
        total_this_week = 0
        active_users = set()
        
        for conversation in conversations:
            for message in conversation["messages"]:
                message_date = datetime.fromisoformat(message["timestamp"]).date()
                
                if message_date == today:
                    total_today += 1
                    active_users.add(conversation["sender"])
                    
                if message_date >= this_week_start:
                    total_this_week += 1
        
        # Calculate average response time (last 100 messages)
        avg_response_time = 0
        if stats["response_times"]:
            avg_response_time = sum(stats["response_times"][-100:]) / min(len(stats["response_times"]), 100)
        
        return {
            "totalChatsToday": total_today,
            "totalChatsThisWeek": total_this_week,
            "activeUsers": len(active_users),
            "averageResponseTime": round(avg_response_time, 2),
            "totalMessages": stats["total_messages"],
            "totalConversations": stats["total_conversations"],
            "uniqueUsers": stats["unique_users"]
        }
    
    def search_conversations(self, query: str) -> List[Dict]:
        """
        Search for conversations containing the query.
        
        Args:
            query: Search query
            
        Returns:
            List of matching conversation objects
        """
        conversations = self._load_conversations()
        results = []
        
        query = query.lower()
        
        for conversation in conversations:
            # Search in sender name or messages
            if (query in conversation["sender_name"].lower() or 
                any(query in message["message"].lower() for message in conversation["messages"])):
                results.append(conversation)
                
        return results
    
    def _load_conversations(self) -> List[Dict]:
        """Load conversations from file."""
        try:
            with open(self.conversations_file, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading conversations: {str(e)}")
            return []
    
    def _save_conversations(self, conversations: List[Dict]):
        """Save conversations to file."""
        try:
            with open(self.conversations_file, "w") as f:
                json.dump(conversations, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving conversations: {str(e)}")
    
    def _update_stats(self, sender: str, response_time: Optional[float] = None):
        """Update statistics."""
        try:
            # Load stats
            with open(self.stats_file, "r") as f:
                stats = json.load(f)
                
            # Update stats
            stats["total_messages"] += 1
            
            # Check if this is a new user
            conversations = self._load_conversations()
            unique_senders = set(conv["sender"] for conv in conversations)
            stats["unique_users"] = len(unique_senders)
            
            # Update total conversations
            stats["total_conversations"] = len(conversations)
            
            # Add response time if available
            if response_time is not None:
                stats["response_times"].append(response_time)
                # Keep only the last 1000 response times
                if len(stats["response_times"]) > 1000:
                    stats["response_times"] = stats["response_times"][-1000:]
            
            # Save stats
            with open(self.stats_file, "w") as f:
                json.dump(stats, f, indent=2)
                
        except Exception as e:
            logger.error(f"Error updating stats: {str(e)}")

# Create a singleton instance
chat_logger = ChatLogger()
