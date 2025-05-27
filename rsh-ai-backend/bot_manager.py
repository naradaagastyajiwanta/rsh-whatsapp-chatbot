"""
Bot Manager for RSH WhatsApp Chatbot
Handles bot status for each chat
"""
import logging
from typing import Dict, Optional

# Configure logging
logger = logging.getLogger(__name__)

class BotManager:
    """
    Manages bot status for each chat
    Default is True (bot is enabled)
    Implemented as a singleton to ensure status is preserved across requests
    """
    _instance = None
    _bot_status: Dict[str, bool] = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(BotManager, cls).__new__(cls)
            # Initialize the dictionary only once
            if not hasattr(cls._instance, '_initialized'):
                cls._instance._initialized = True
        return cls._instance
        
    def __init__(self):
        # Dictionary is already initialized in __new__
        pass
    
    def is_bot_enabled(self, chat_id: str) -> bool:
        """
        Check if bot is enabled for a specific chat
        Default is True if not set
        """
        return self._bot_status.get(chat_id, True)
    
    def set_bot_status(self, chat_id: str, enabled: bool) -> None:
        """
        Set bot status for a specific chat
        """
        self._bot_status[chat_id] = enabled
        logger.info(f"Bot status for chat {chat_id} set to {enabled}")
    
    def toggle_bot_status(self, chat_id: str) -> bool:
        """
        Toggle bot status for a specific chat
        Returns the new status
        """
        current_status = self.is_bot_enabled(chat_id)
        new_status = not current_status
        self._bot_status[chat_id] = new_status
        logger.info(f"Bot status for chat {chat_id} toggled from {current_status} to {new_status}")
        return new_status
    
    def get_all_statuses(self) -> Dict[str, bool]:
        """
        Get all bot statuses
        """
        return self._bot_status.copy()
