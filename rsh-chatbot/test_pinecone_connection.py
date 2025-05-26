import os
from dotenv import load_dotenv
import pinecone
import requests
import socket

# Load environment variables
load_dotenv()

# Access environment variables
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_ENVIRONMENT = os.getenv("PINECONE_ENVIRONMENT")

print(f"Testing Pinecone connection with:")
print(f"API Key: {PINECONE_API_KEY[:5]}...{PINECONE_API_KEY[-5:]}")
print(f"Environment: {PINECONE_ENVIRONMENT}")

# Test basic internet connectivity
print("\nTesting internet connectivity...")
try:
    response = requests.get("https://www.google.com", timeout=5)
    print(f"Internet connectivity: OK (Status code: {response.status_code})")
except Exception as e:
    print(f"Internet connectivity: FAILED ({str(e)})")

# Test DNS resolution
print("\nTesting DNS resolution...")
try:
    host = f"controller.{PINECONE_ENVIRONMENT}.pinecone.io"
    print(f"Attempting to resolve: {host}")
    ip = socket.gethostbyname(host)
    print(f"DNS resolution: OK (IP: {ip})")
except Exception as e:
    print(f"DNS resolution: FAILED ({str(e)})")

# Test Pinecone API
print("\nTesting Pinecone API connection...")
try:
    pinecone.init(api_key=PINECONE_API_KEY, environment=PINECONE_ENVIRONMENT)
    indexes = pinecone.list_indexes()
    print(f"Pinecone API connection: OK (Available indexes: {indexes})")
except Exception as e:
    print(f"Pinecone API connection: FAILED ({str(e)})")

print("\nTest complete.")
