import os
import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class UserPreferencesManager:
    def __init__(self):
        self.data_dir = "analytics_data"
        self.preferences_file = os.path.join(self.data_dir, "user_preferences.json")
        self.ensure_preferences_file()
    
    def ensure_preferences_file(self):
        """Memastikan file preferences ada"""
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
            
        if not os.path.exists(self.preferences_file):
            with open(self.preferences_file, "w") as f:
                json.dump({
                    "selected_user": None,
                    "admin_preferences": {}
                }, f)
    
    def get_selected_user(self) -> Optional[str]:
        """Mendapatkan pengguna yang terakhir dipilih"""
        try:
            with open(self.preferences_file, "r") as f:
                data = json.load(f)
                return data.get("selected_user")
        except Exception as e:
            logger.error(f"Error getting selected user: {str(e)}")
            return None
    
    def set_selected_user(self, user_id: str) -> bool:
        """Menyimpan pengguna yang dipilih"""
        try:
            with open(self.preferences_file, "r") as f:
                data = json.load(f)
            
            data["selected_user"] = user_id
            
            with open(self.preferences_file, "w") as f:
                json.dump(data, f)
            
            return True
        except Exception as e:
            logger.error(f"Error setting selected user: {str(e)}")
            return False
    
    def get_admin_preferences(self) -> Dict[str, Any]:
        """Mendapatkan preferensi admin"""
        try:
            with open(self.preferences_file, "r") as f:
                data = json.load(f)
                return data.get("admin_preferences", {})
        except Exception as e:
            logger.error(f"Error getting admin preferences: {str(e)}")
            return {}
    
    def set_admin_preference(self, key: str, value: Any) -> bool:
        """Menyimpan preferensi admin"""
        try:
            with open(self.preferences_file, "r") as f:
                data = json.load(f)
            
            if "admin_preferences" not in data:
                data["admin_preferences"] = {}
            
            data["admin_preferences"][key] = value
            
            with open(self.preferences_file, "w") as f:
                json.dump(data, f)
            
            return True
        except Exception as e:
            logger.error(f"Error setting admin preference: {str(e)}")
            return False

# Create singleton instance
user_preferences = UserPreferencesManager()
