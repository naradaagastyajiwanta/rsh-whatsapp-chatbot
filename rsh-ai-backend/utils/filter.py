"""
Utility functions for filtering and processing content.
This module can be expanded with custom filters for the chatbot responses.
"""

import re
from typing import List, Dict, Any, Optional


def clean_text(text: str) -> str:
    """
    Clean and normalize text input.
    
    Args:
        text: Input text to clean
        
    Returns:
        Cleaned text
    """
    if not text:
        return ""
    
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text.strip())
    
    return text


def filter_sensitive_info(text: str) -> str:
    """
    Filter out potentially sensitive information from text.
    
    Args:
        text: Input text to filter
        
    Returns:
        Filtered text
    """
    if not text:
        return ""
    
    # Filter out potential phone numbers (simple pattern)
    text = re.sub(r'\b(?:\+?[0-9]{10,15})\b', '[NOMOR TELEPON]', text)
    
    # Filter out potential email addresses
    text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]', text)
    
    return text


def extract_entities(text: str) -> Dict[str, List[str]]:
    """
    Extract entities from text (placeholder for future NER implementation).
    
    Args:
        text: Input text to extract entities from
        
    Returns:
        Dictionary of entity types and their values
    """
    # This is a placeholder for future implementation
    # Could be expanded with proper NER using spaCy or other libraries
    return {
        "names": [],
        "locations": [],
        "organizations": []
    }


def check_content_safety(text: str) -> Dict[str, Any]:
    """
    Check content for safety concerns (placeholder for content moderation).
    
    Args:
        text: Input text to check
        
    Returns:
        Dictionary with safety assessment
    """
    # This is a placeholder for future implementation
    # Could be expanded with proper content moderation using OpenAI's moderation API
    return {
        "is_safe": True,
        "categories": {},
        "category_scores": {}
    }
