from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit
import json
import os
import time
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Fungsi untuk menambahkan header CORS ke respons
def add_cors_headers(response):
    # Hapus header CORS yang mungkin sudah ada untuk menghindari duplikasi
    if 'Access-Control-Allow-Origin' in response.headers:
        del response.headers['Access-Control-Allow-Origin']
    if 'Access-Control-Allow-Headers' in response.headers:
        del response.headers['Access-Control-Allow-Headers']
    if 'Access-Control-Allow-Methods' in response.headers:
        del response.headers['Access-Control-Allow-Methods']
        
    # Tambahkan header CORS yang benar
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Cache-Control, Pragma, Expires'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
    return response

@app.after_request
def after_request_middleware(response):
    return add_cors_headers(response)

# Endpoint health check
@app.route('/health', methods=['GET', 'OPTIONS'])
def health_check():
    # Handle OPTIONS request for CORS preflight
    if request.method == 'OPTIONS':
        response = jsonify({})
        return add_cors_headers(response)
    
    response = jsonify({
        'status': 'ok',
        'message': 'Server is running',
        'version': '1.0.0',
        'server_time': time.time()
    })
    
    return response

# Endpoint untuk analytics performance
@app.route('/admin/analytics/performance', methods=['GET', 'OPTIONS'])
def get_performance_analytics():
    # Handle OPTIONS request for CORS preflight
    if request.method == 'OPTIONS':
        response = jsonify({})
        return add_cors_headers(response)
    
    # Data dummy untuk testing
    performance_data = {
        "api_calls": 120,
        "total_response_time": 45.6,
        "average_response_time": 0.38,
        "success_rate": 98.5,
        "error_count": 2,
        "daily_metrics": {
            "2025-05-22": {"api_calls": 40, "total_response_time": 15.2, "error_count": 1},
            "2025-05-23": {"api_calls": 35, "total_response_time": 13.3, "error_count": 0},
            "2025-05-24": {"api_calls": 45, "total_response_time": 17.1, "error_count": 1}
        }
    }
    
    response = jsonify(performance_data)
    return response

# Endpoint untuk analytics users
@app.route('/admin/analytics/users', methods=['GET', 'OPTIONS'])
def get_user_analytics():
    # Handle OPTIONS request for CORS preflight
    if request.method == 'OPTIONS':
        response = jsonify({})
        return add_cors_headers(response)
    
    # Data dummy untuk testing
    user_data = {
        "total_users": 5,
        "active_users": 3,
        "new_users": 1,
        "users": {
            "6281234567890@s.whatsapp.net": {
                "details": {
                    "name": "John Doe",
                    "age": 35,
                    "gender": "male",
                    "location": "Jakarta",
                    "health_complaints": ["sakit kepala", "demam"],
                    "conversion_barriers": ["biaya tinggi"],
                    "first_interaction": "2025-05-20T10:30:00",
                    "last_interaction": "2025-05-29T09:15:00"
                },
                "latest_analysis": {
                    "name": "John Doe",
                    "age": 35,
                    "gender": "male",
                    "location": "Jakarta",
                    "health_complaints": ["sakit kepala", "demam"],
                    "symptoms": ["pusing", "suhu tinggi"],
                    "medical_history": "Tidak ada riwayat penyakit serius",
                    "urgency_level": "medium",
                    "emotion": "neutral",
                    "conversion_barriers": ["biaya tinggi"],
                    "interest_level": "high",
                    "program_awareness": "basic",
                    "timestamp": "2025-05-29T09:15:00"
                },
                "first_interaction": "2025-05-20T10:30:00",
                "interactions": [
                    {
                        "timestamp": "2025-05-20T10:30:00",
                        "analysis": {
                            "name": "John Doe",
                            "age": 35,
                            "gender": "male",
                            "location": "Jakarta",
                            "health_complaints": ["sakit kepala"],
                            "symptoms": ["pusing"],
                            "medical_history": null,
                            "urgency_level": "low",
                            "emotion": "neutral",
                            "conversion_barriers": [],
                            "interest_level": "medium",
                            "program_awareness": "none",
                            "timestamp": "2025-05-20T10:30:00"
                        }
                    },
                    {
                        "timestamp": "2025-05-29T09:15:00",
                        "analysis": {
                            "name": "John Doe",
                            "age": 35,
                            "gender": "male",
                            "location": "Jakarta",
                            "health_complaints": ["sakit kepala", "demam"],
                            "symptoms": ["pusing", "suhu tinggi"],
                            "medical_history": "Tidak ada riwayat penyakit serius",
                            "urgency_level": "medium",
                            "emotion": "neutral",
                            "conversion_barriers": ["biaya tinggi"],
                            "interest_level": "high",
                            "program_awareness": "basic",
                            "timestamp": "2025-05-29T09:15:00"
                        }
                    }
                ]
            }
        }
    }
    
    response = jsonify(user_data)
    return response

# WebSocket event handlers
@socketio.on('connect')
def handle_connect():
    logger.info('Client connected to WebSocket')
    # Kirim data analytics awal saat client terhubung
    emit_analytics_data()

@socketio.on('disconnect')
def handle_disconnect():
    logger.info('Client disconnected from WebSocket')

@socketio.on('subscribe_to_analytics')
def handle_subscribe_to_analytics():
    logger.info('Client subscribed to analytics updates')
    emit_analytics_data()

# Fungsi untuk mengirim data analytics ke client
def emit_analytics_data():
    try:
        # Data performance metrics
        performance_data = {
            "api_calls": 120,
            "total_response_time": 45.6,
            "average_response_time": 0.38,
            "success_rate": 98.5,
            "error_count": 2,
            "daily_metrics": {
                "2025-05-22": {"api_calls": 40, "total_response_time": 15.2, "error_count": 1},
                "2025-05-23": {"api_calls": 35, "total_response_time": 13.3, "error_count": 0},
                "2025-05-24": {"api_calls": 45, "total_response_time": 17.1, "error_count": 1}
            }
        }
        
        # Data user analytics
        user_data = {
            "total_users": 5,
            "active_users": 3,
            "new_users": 1,
            "users": {
                "6281234567890@s.whatsapp.net": {
                    "details": {
                        "name": "John Doe",
                        "age": 35,
                        "gender": "male",
                        "location": "Jakarta",
                        "health_complaints": ["sakit kepala", "demam"],
                        "conversion_barriers": ["biaya tinggi"],
                        "first_interaction": "2025-05-20T10:30:00",
                        "last_interaction": "2025-05-29T09:15:00"
                    },
                    "latest_analysis": {
                        "name": "John Doe",
                        "age": 35,
                        "gender": "male",
                        "location": "Jakarta",
                        "health_complaints": ["sakit kepala", "demam"],
                        "symptoms": ["pusing", "suhu tinggi"],
                        "medical_history": "Tidak ada riwayat penyakit serius",
                        "urgency_level": "medium",
                        "emotion": "neutral",
                        "conversion_barriers": ["biaya tinggi"],
                        "interest_level": "high",
                        "program_awareness": "basic",
                        "timestamp": "2025-05-29T09:15:00"
                    },
                    "first_interaction": "2025-05-20T10:30:00",
                    "interactions": []
                }
            }
        }
        
        # Emit data to client
        emit('analytics:performance', performance_data)
        logger.info('Emitted performance analytics data')
        
        emit('analytics:users', user_data)
        logger.info('Emitted user analytics data')
        
        # Emit combined data
        emit('analytics_update', {
            'type': 'initial_data',
            'data': {
                'performance': performance_data,
                'users': user_data
            }
        })
        logger.info('Emitted combined analytics data')
        
    except Exception as e:
        logger.error(f'Error emitting analytics data: {str(e)}')

if __name__ == '__main__':
    port = 5000
    print(f"Starting CORS test server with WebSocket on port {port}")
    socketio.run(app, host='0.0.0.0', port=port, debug=True, allow_unsafe_werkzeug=True)
