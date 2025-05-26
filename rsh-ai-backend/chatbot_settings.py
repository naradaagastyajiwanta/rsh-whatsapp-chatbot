"""
Chatbot settings module for RSH AI Backend
Handles default settings and settings management
"""

import os
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Default settings
DEFAULT_SETTINGS = {
    "initialPrompt": "Anda adalah asisten AI untuk RSH Satu Bumi yang membantu menjawab pertanyaan tentang program kesehatan dan detoksifikasi. Jawab dengan sopan, informatif, dan sesuai dengan nilai-nilai RSH Satu Bumi.",
    "maxTokens": 500,
    "temperature": 0.7,
    "modelName": "gpt-3.5-turbo"
}

# Path to settings file
SETTINGS_FILE = Path("chatbot_settings.json")

def load_settings():
    """
    Load settings from file or return defaults if file doesn't exist
    """
    try:
        if SETTINGS_FILE.exists():
            with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
                settings = json.load(f)
                logger.info("Loaded settings from file")
                return settings
        else:
            logger.info("Settings file not found, using defaults")
            return DEFAULT_SETTINGS
    except Exception as e:
        logger.error(f"Error loading settings: {str(e)}")
        return DEFAULT_SETTINGS

def save_settings(settings):
    """
    Save settings to file
    """
    try:
        with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(settings, f, indent=2, ensure_ascii=False)
        logger.info("Settings saved to file")
        return True
    except Exception as e:
        logger.error(f"Error saving settings: {str(e)}")
        return False

# Initialize settings on module import
current_settings = load_settings()

def get_settings():
    """
    Get current settings
    """
    return current_settings

def update_settings(new_settings):
    """
    Update settings and save to file
    """
    global current_settings
    
    # Validate settings
    if not isinstance(new_settings, dict):
        logger.error("Invalid settings format")
        return False
    
    # Ensure all required fields are present
    for key in DEFAULT_SETTINGS:
        if key not in new_settings:
            new_settings[key] = DEFAULT_SETTINGS[key]
    
    # Update current settings
    current_settings = new_settings
    
    # Save to file
    return save_settings(current_settings)
