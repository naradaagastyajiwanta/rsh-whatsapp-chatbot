import os
import sys
import time
from dotenv import load_dotenv
from langchain_community.embeddings.openai import OpenAIEmbeddings
from langchain.text_splitter import CharacterTextSplitter
from langchain_community.vectorstores import Pinecone
from langchain_community.document_loaders import TextLoader
import requests
import json
from typing import List, Dict, Any

# Load environment variables
load_dotenv()

# Access environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_ENVIRONMENT = os.getenv("PINECONE_ENVIRONMENT")

# Check if all required environment variables are set
if not all([OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_ENVIRONMENT]):
    missing_vars = []
    if not OPENAI_API_KEY:
        missing_vars.append("OPENAI_API_KEY")
    if not PINECONE_API_KEY:
        missing_vars.append("PINECONE_API_KEY")
    if not PINECONE_ENVIRONMENT:
        missing_vars.append("PINECONE_ENVIRONMENT")
    
    print(f"Error: Missing environment variables: {', '.join(missing_vars)}")
    print("Please check your .env file and ensure all required variables are set.")
    exit(1)

# Initialize Pinecone client
# Define index name and host URL
INDEX_NAME = "rsh-chatbot-index"
INDEX_HOST = "https://rsh-chatbot-index-1q0d989.svc.aped-4627-b74a.pinecone.io"

print(f"Using Pinecone index: {INDEX_NAME}")
print(f"Index host: {INDEX_HOST}")

# Test direct connection to the index
try:
    # Test if we can reach the host directly
    print("Testing direct connection to index host...")
    headers = {"Api-Key": PINECONE_API_KEY}
    response = requests.get(f"{INDEX_HOST}/describe_index_stats", headers=headers)
    
    if response.status_code == 200:
        print("Successfully connected to Pinecone index!")
    else:
        print(f"Error connecting to index: {response.status_code} - {response.text}")
        sys.exit(1)
except Exception as e:
    print(f"Error connecting to Pinecone index: {e}")
    print("This may be due to network connectivity issues or firewall settings.")
    print("Please check your internet connection and try again.")
    sys.exit(1)

# Initialize embeddings using a model that produces 1024-dimensional embeddings
from langchain_community.embeddings import HuggingFaceEmbeddings

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/LaBSE",  # This model outputs 768-dim embeddings
    model_kwargs={'device': 'cpu'},
    encode_kwargs={'normalize_embeddings': True}
)

# Define a function to pad embeddings to match the required dimension
def pad_embedding(embedding, target_dim=1024):
    """Pad embedding vector to the target dimension."""
    current_dim = len(embedding)
    if current_dim >= target_dim:
        return embedding[:target_dim]  # Truncate if larger
    else:
        # Pad with zeros to reach target dimension
        return embedding + [0.0] * (target_dim - current_dim)

# Load the document
doc_path = os.path.join("docs", "rsh_programs.txt")
loader = TextLoader(doc_path, encoding="utf-8")
documents = loader.load()
print(f"Loaded document: {doc_path}")

# Split the document into chunks
text_splitter = CharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=50,
    separator="\n"
)
docs = text_splitter.split_documents(documents)
print(f"Split document into {len(docs)} chunks")

# Function to directly upload vectors to Pinecone using REST API
def upload_to_pinecone(vectors: List[Dict[str, Any]], api_key: str, host: str) -> None:
    headers = {
        "Api-Key": api_key,
        "Content-Type": "application/json"
    }
    
    # Batch vectors in groups of 100 to avoid request size limits
    batch_size = 100
    total_vectors = len(vectors)
    batches = [vectors[i:i + batch_size] for i in range(0, total_vectors, batch_size)]
    
    print(f"Uploading {total_vectors} vectors in {len(batches)} batches...")
    
    for i, batch in enumerate(batches):
        print(f"Uploading batch {i+1}/{len(batches)}...")
        
        payload = {
            "vectors": batch
        }
        
        response = requests.post(f"{host}/vectors/upsert", headers=headers, json=payload)
        
        if response.status_code != 200:
            print(f"Error uploading batch {i+1}: {response.status_code} - {response.text}")
            raise Exception(f"Failed to upload vectors: {response.text}")
        
        print(f"Successfully uploaded batch {i+1}")

# Create embeddings for documents
print("Creating embeddings for documents...")
try:
    # Generate embeddings for each document
    texts = [doc.page_content for doc in docs]
    metadatas = [doc.metadata for doc in docs]
    
    # Get embeddings
    embeddings_list = embeddings.embed_documents(texts)
    
    # Prepare vectors for Pinecone and pad to 1024 dimensions
    vectors = []
    for i, (text, embedding_vector, metadata) in enumerate(zip(texts, embeddings_list, metadatas)):
        # Pad the embedding vector to 1024 dimensions
        padded_vector = pad_embedding(embedding_vector, target_dim=1024)
        
        vectors.append({
            "id": f"doc_{i}",
            "values": padded_vector,
            "metadata": {
                "text": text,
                **metadata
            }
        })
    
    # Upload vectors to Pinecone
    print(f"Uploading {len(vectors)} vectors to Pinecone...")
    upload_to_pinecone(vectors, PINECONE_API_KEY, INDEX_HOST)
    
    print(f"Successfully indexed documents to Pinecone index: {INDEX_NAME}")
    print(f"Total chunks indexed: {len(docs)}")
    print("Indexing complete!")
except Exception as e:
    print(f"Error uploading documents to Pinecone: {e}")
    print(f"Error details: {str(e)}")
    sys.exit(1)

# Example of how to query the index (commented out)
"""
# To retrieve similar documents:
query = "What healthcare programs does RSH Satu Bumi offer?"
retriever = Pinecone.from_existing_index(
    index_name=INDEX_NAME,
    embedding=embeddings,
    environment=PINECONE_ENVIRONMENT
).as_retriever()
docs = retriever.get_relevant_documents(query)
for doc in docs:
    print(doc.page_content)
    print("-" * 50)
"""
