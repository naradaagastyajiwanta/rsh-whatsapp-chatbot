"""
Admin dashboard API routes for the RSH WhatsApp Chatbot
"""
import os
import logging
from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request
from typing import List, Dict, Any

# Configure logging
logger = logging.getLogger(__name__)

# Create a Blueprint for admin routes
admin_bp = Blueprint('admin', __name__)

# In-memory storage for chat logs (in a real app, this would be a database)
chat_logs = []
chat_stats = {
    "totalChatsToday": 0,
    "totalChatsThisWeek": 0,
    "activeUsers": 0,
    "averageResponseTime": 0
}

# Sample data for testing
def initialize_sample_data():
    global chat_logs, chat_stats
    
    # Only initialize if empty
    if not chat_logs:
        chat_logs = [
            {
                "id": "1",
                "sender": "6281234567890@s.whatsapp.net",
                "senderName": "John Doe",
                "lastMessage": "Apa itu program 7 hari menuju sehat raga dan jiwa?",
                "lastTimestamp": "2025-05-25T10:30:00Z",
                "messages": [
                    {
                        "id": "1-1",
                        "content": "Apa itu program 7 hari menuju sehat raga dan jiwa?",
                        "timestamp": "2025-05-25T10:30:00Z",
                        "isFromUser": True,
                    },
                    {
                        "id": "1-2",
                        "content": "Program 7 Hari Menuju Sehat Raga & Jiwa adalah program intensif yang dirancang oleh RSH Satu Bumi untuk membantu Anda mencapai keseimbangan fisik dan mental dalam waktu singkat. Program ini mencakup kombinasi terapi holistik, pola makan sehat, meditasi, dan aktivitas fisik yang disesuaikan dengan kebutuhan individu.",
                        "timestamp": "2025-05-25T10:30:15Z",
                        "isFromUser": False,
                    },
                ],
            },
            {
                "id": "2",
                "sender": "6289876543210@s.whatsapp.net",
                "senderName": "Jane Smith",
                "lastMessage": "Bagaimana cara mendaftar untuk konsultasi kesehatan?",
                "lastTimestamp": "2025-05-25T09:45:00Z",
                "messages": [
                    {
                        "id": "2-1",
                        "content": "Halo, saya ingin bertanya tentang layanan konsultasi kesehatan",
                        "timestamp": "2025-05-25T09:44:00Z",
                        "isFromUser": True,
                    },
                    {
                        "id": "2-2",
                        "content": "Tentu, kami menyediakan layanan konsultasi kesehatan holistik. Ada yang bisa saya bantu?",
                        "timestamp": "2025-05-25T09:44:15Z",
                        "isFromUser": False,
                    },
                    {
                        "id": "2-3",
                        "content": "Bagaimana cara mendaftar untuk konsultasi kesehatan?",
                        "timestamp": "2025-05-25T09:45:00Z",
                        "isFromUser": True,
                    },
                    {
                        "id": "2-4",
                        "content": "Untuk mendaftar konsultasi kesehatan, Anda dapat menghubungi kami di nomor (021) 12345678 atau melalui email di info@rshsatubumi.com. Kami akan membantu Anda menjadwalkan sesi konsultasi sesuai dengan kebutuhan Anda.",
                        "timestamp": "2025-05-25T09:45:30Z",
                        "isFromUser": False,
                    },
                ],
            }
        ]
        
        # Initialize stats
        chat_stats = {
            "totalChatsToday": 15,
            "totalChatsThisWeek": 87,
            "activeUsers": 42,
            "averageResponseTime": 12  # seconds
        }

# Initialize sample data
initialize_sample_data()

# Function to log a new chat message
def log_chat_message(sender: str, sender_name: str, message: str, response: str):
    """
    Log a new chat message and its response
    """
    global chat_logs, chat_stats
    
    now = datetime.utcnow().isoformat() + "Z"
    
    # Check if this sender already has a chat
    existing_chat = next((chat for chat in chat_logs if chat["sender"] == sender), None)
    
    if existing_chat:
        # Add to existing chat
        message_id = f"{existing_chat['id']}-{len(existing_chat['messages']) + 1}"
        response_id = f"{existing_chat['id']}-{len(existing_chat['messages']) + 2}"
        
        # Add user message
        existing_chat["messages"].append({
            "id": message_id,
            "content": message,
            "timestamp": now,
            "isFromUser": True
        })
        
        # Add bot response
        existing_chat["messages"].append({
            "id": response_id,
            "content": response,
            "timestamp": now,
            "isFromUser": False
        })
        
        # Update last message and timestamp
        existing_chat["lastMessage"] = message
        existing_chat["lastTimestamp"] = now
    else:
        # Create new chat
        chat_id = str(len(chat_logs) + 1)
        new_chat = {
            "id": chat_id,
            "sender": sender,
            "senderName": sender_name or "Unknown User",
            "lastMessage": message,
            "lastTimestamp": now,
            "messages": [
                {
                    "id": f"{chat_id}-1",
                    "content": message,
                    "timestamp": now,
                    "isFromUser": True
                },
                {
                    "id": f"{chat_id}-2",
                    "content": response,
                    "timestamp": now,
                    "isFromUser": False
                }
            ]
        }
        chat_logs.append(new_chat)
    
    # Update stats
    chat_stats["totalChatsToday"] += 1
    chat_stats["totalChatsThisWeek"] += 1
    
    # Get unique active users
    unique_senders = set(chat["sender"] for chat in chat_logs)
    chat_stats["activeUsers"] = len(unique_senders)
    
    logger.info(f"Logged chat message from {sender}")

# Routes for the admin dashboard

@admin_bp.route('/chats', methods=['GET'])
def get_chats():
    """Get all chats"""
    return jsonify(chat_logs)

@admin_bp.route('/chats/<chat_id>', methods=['GET'])
def get_chat_by_id(chat_id):
    """Get a specific chat by ID"""
    chat = next((chat for chat in chat_logs if chat["id"] == chat_id), None)
    if not chat:
        return jsonify({"error": "Chat not found"}), 404
    return jsonify(chat)

@admin_bp.route('/chats/search', methods=['GET'])
def search_chats():
    """Search chats by query"""
    query = request.args.get('q', '').lower()
    if not query:
        return jsonify(chat_logs)
    
    filtered_chats = []
    for chat in chat_logs:
        # Search in sender
        if query in chat["sender"].lower():
            filtered_chats.append(chat)
            continue
        
        # Search in last message
        if query in chat["lastMessage"].lower():
            filtered_chats.append(chat)
            continue
        
        # Search in messages
        for message in chat["messages"]:
            if query in message["content"].lower():
                filtered_chats.append(chat)
                break
    
    return jsonify(filtered_chats)

@admin_bp.route('/stats', methods=['GET'])
def get_stats():
    """Get chat statistics"""
    return jsonify(chat_stats)

# Webhook to log messages from the WhatsApp service
@admin_bp.route('/log', methods=['POST'])
def log_message():
    """Log a message from the WhatsApp service"""
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    sender = data.get('sender')
    message = data.get('message')
    response = data.get('response')
    sender_name = data.get('sender_name')
    
    if not all([sender, message, response]):
        return jsonify({"error": "Missing required fields"}), 400
    
    log_chat_message(sender, sender_name, message, response)
    
    return jsonify({"status": "success"}), 200
