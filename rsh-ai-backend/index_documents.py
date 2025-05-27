import os
import sys
import logging
from typing import List, Dict, Any
import numpy as np
from dotenv import load_dotenv
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from pinecone import Pinecone, ServerlessSpec

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

def pad_embedding(embedding, target_dim=1536):
    """Pad or truncate an embedding to the target dimension."""
    if not embedding:
        return [0.0] * target_dim
        
    # Convert to numpy array for easier manipulation
    embedding_array = np.array(embedding)
    current_dim = len(embedding_array)
    
    # If current dimension is already target dimension, return as is
    if current_dim == target_dim:
        return embedding
    
    # If current dimension is larger, truncate
    if current_dim > target_dim:
        return embedding_array[:target_dim].tolist()
    
    # If current dimension is smaller, pad with zeros
    padded = np.zeros(target_dim)
    padded[:current_dim] = embedding_array
    return padded.tolist()

def read_document(file_path: str) -> str:
    """Read document content from file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        logger.error(f"Error reading file {file_path}: {str(e)}")
        sys.exit(1)

def split_text(text: str) -> List[str]:
    """Split text into chunks."""
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
    )
    return text_splitter.split_text(text)

def create_embeddings(chunks: List[str]) -> List[List[float]]:
    """Create embeddings for text chunks."""
    try:
        embeddings = OpenAIEmbeddings(
            model="text-embedding-ada-002",
            openai_api_key=os.getenv("OPENAI_API_KEY")
        )
        
        # Process each chunk and ensure it has the correct dimension
        vectors = []
        for i, chunk in enumerate(chunks):
            logger.info(f"Creating embedding for chunk {i+1}/{len(chunks)}")
            embedding = embeddings.embed_query(chunk)
            # Ensure embedding has the correct dimension
            padded_embedding = pad_embedding(embedding, 1536)
            vectors.append(padded_embedding)
        
        return vectors
    except Exception as e:
        logger.error(f"Error creating embeddings: {str(e)}")
        sys.exit(1)

def upload_to_pinecone(chunks: List[str], vectors: List[List[float]]):
    """Upload vectors to Pinecone."""
    try:
        # Initialize Pinecone client
        pinecone_api_key = os.getenv("PINECONE_API_KEY")
        if not pinecone_api_key:
            logger.error("PINECONE_API_KEY environment variable not set")
            sys.exit(1)
            
        pc = Pinecone(api_key=pinecone_api_key)
        
        # Get the index
        index_name = os.getenv("PINECONE_INDEX_NAME", "rsh-chatbot-index")
        index = pc.Index(index_name)
        
        # Prepare vectors for upload
        vectors_to_upsert = []
        for i, (chunk, vector) in enumerate(zip(chunks, vectors)):
            vectors_to_upsert.append({
                "id": f"doc_{i}",
                "values": vector,
                "metadata": {
                    "text": chunk,
                    "source": "rsh_programs.txt"
                }
            })
        
        # Upsert vectors in batches
        batch_size = 100
        for i in range(0, len(vectors_to_upsert), batch_size):
            batch = vectors_to_upsert[i:i+batch_size]
            logger.info(f"Upserting batch {i//batch_size + 1}/{(len(vectors_to_upsert) + batch_size - 1)//batch_size}")
            index.upsert(vectors=batch)
        
        logger.info(f"Successfully uploaded {len(vectors_to_upsert)} vectors to Pinecone")
    except Exception as e:
        logger.error(f"Error uploading to Pinecone: {str(e)}")
        sys.exit(1)

def main():
    """Main function to index documents."""
    # Get document path
    if len(sys.argv) > 1:
        document_path = sys.argv[1]
    else:
        document_path = "g:/NAJ/Skripsi 3/Windsurf/rsh-chatbot/docs/rsh_programs.txt"
    
    logger.info(f"Indexing document: {document_path}")
    
    # Read document
    text = read_document(document_path)
    logger.info(f"Document read successfully: {len(text)} characters")
    
    # Split text into chunks
    chunks = split_text(text)
    logger.info(f"Document split into {len(chunks)} chunks")
    
    # Create embeddings
    vectors = create_embeddings(chunks)
    logger.info(f"Created {len(vectors)} embeddings")
    
    # Upload to Pinecone
    upload_to_pinecone(chunks, vectors)
    
    logger.info("Indexing completed successfully")

if __name__ == "__main__":
    main()
