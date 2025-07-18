import os
import logging
import requests
from typing import List, Dict, Any
import numpy as np

from langchain.chains import RetrievalQA
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_pinecone import PineconeVectorStore
from langchain.prompts import PromptTemplate
from pinecone import Pinecone

logger = logging.getLogger(__name__)

def pad_embedding(embedding, target_dim=1536):
    """Pad or truncate an embedding to the target dimension.
    
    Args:
        embedding: The original embedding vector
        target_dim: The target dimension (default: 1024)
        
    Returns:
        A vector of the target dimension
    """
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

class RAGPipeline:
    """
    Retrieval-Augmented Generation (RAG) pipeline using LangChain, Pinecone, and OpenAI.
    """
    
    def __init__(
        self,
        openai_api_key: str,
        pinecone_api_key: str,
        pinecone_environment: str,
        index_name: str = "rsh-chatbot-index",
        model_name: str = "gpt-3.5-turbo",
        embedding_model: str = "text-embedding-ada-002",
        temperature: float = 0.7,
        max_tokens: int = 1000
    ):
        """
        Initialize the RAG pipeline.
        
        Args:
            openai_api_key: OpenAI API key
            pinecone_api_key: Pinecone API key
            pinecone_environment: Pinecone environment
            index_name: Name of the Pinecone index
            model_name: Name of the OpenAI model to use
            embedding_model: Name of the OpenAI embedding model
            temperature: Temperature for text generation
            max_tokens: Maximum number of tokens to generate
        """
        self.openai_api_key = openai_api_key
        self.pinecone_api_key = pinecone_api_key
        self.pinecone_environment = pinecone_environment
        self.index_name = index_name
        self.model_name = model_name
        self.embedding_model = embedding_model
        self.temperature = temperature
        self.max_tokens = max_tokens
        
        # Initialize components
        self._init_embeddings()
        self._init_vectorstore()
        self._init_llm()
        self._init_qa_chain()
        
        logger.info(f"RAG pipeline initialized with model: {model_name}")
    
    def _init_embeddings(self):
        """Initialize the embedding model."""
        try:
            # Use standard OpenAIEmbeddings
            self.embeddings = OpenAIEmbeddings(
                model=self.embedding_model,
                openai_api_key=self.openai_api_key
            )
            
            # In newer versions of LangChain, the API might have changed
            # We'll create our own implementation for embedding documents and queries
            
            # We won't try to store or override the original methods
            # as they might not exist in the current version of LangChain
            
            logger.info(f"Initialized embeddings with model: {self.embedding_model}")
        except Exception as e:
            logger.error(f"Failed to initialize embeddings: {str(e)}")
            raise
    
    def embed_documents(self, texts):
        """Embed documents using the embeddings model.
        
        This is our custom implementation that doesn't rely on the
        embed_documents method of OpenAIEmbeddings which might not exist.
        It also ensures that all embeddings are padded to 1024 dimensions.
        """
        try:
            # Process each text individually using the embeddings model directly
            embeddings = []
            for text in texts:
                try:
                    # Try to use embed_query if it exists
                    if hasattr(self.embeddings, 'embed_query'):
                        embedding = self.embeddings.embed_query(text)
                    else:
                        # Fall back to __call__ method
                        embedding = self.embeddings(text)
                    # Pad embedding to 1024 dimensions
                    padded_embedding = pad_embedding(embedding, 1536)
                    embeddings.append(padded_embedding)
                except Exception as e:
                    logger.error(f"Error embedding text: {str(e)}")
                    # Return a zero vector as fallback
                    embeddings.append([0.0] * 1536)
            return embeddings
        except Exception as e:
            logger.error(f"Error in embed_documents: {str(e)}")
            # Return empty list as fallback
            return []
    
    def embed_query(self, text):
        """Embed a single query using the embeddings model.
        
        This is our custom implementation that doesn't rely on the
        embed_query method of OpenAIEmbeddings which might not exist.
        It also ensures that the embedding is padded to 1024 dimensions.
        """
        try:
            # Try to use embed_query if it exists
            if hasattr(self.embeddings, 'embed_query'):
                embedding = self.embeddings.embed_query(text)
            else:
                # Fall back to __call__ method
                embedding = self.embeddings(text)
            
            # Pad embedding to 1024 dimensions
            return pad_embedding(embedding, 1024)
        except Exception as e:
            logger.error(f"Error in embed_query: {str(e)}")
            # Return a zero vector as fallback
            return [0.0] * 1536
    
    def _init_vectorstore(self):
        """Initialize the Pinecone vector store using the new langchain-pinecone integration."""
        try:
            # Initialize Pinecone client with the new SDK
            pc = Pinecone(api_key=self.pinecone_api_key)
            logger.info(f"Initialized Pinecone client")
            
            # Check if index exists
            index_list = pc.list_indexes()
            index_names = [index.name for index in index_list]
            
            if self.index_name not in index_names:
                logger.warning(f"Pinecone index '{self.index_name}' does not exist, attempting to create it")
                # Create the index if it doesn't exist
                try:
                    # Create index using new SDK
                    pc.create_index(
                        name=self.index_name,
                        dimension=1024,  # Match existing Pinecone index dimension
                        metric='cosine'
                    )
                    logger.info(f"Created new Pinecone index: {self.index_name}")
                except Exception as create_error:
                    logger.error(f"Failed to create Pinecone index: {str(create_error)}")
                    raise
            
            # Get the index
            index = pc.Index(self.index_name)
            logger.info(f"Connected to Pinecone index: {self.index_name}")
            
            # Connect to the index using the new langchain-pinecone integration
            self.vectorstore = PineconeVectorStore(
                index=index,
                embedding=self.embeddings,
                text_key="text"  # The metadata key that contains the text
            )
            
            logger.info(f"Initialized LangChain vectorstore with Pinecone index: {self.index_name}")
        except Exception as e:
            logger.error(f"Failed to initialize vector store: {str(e)}")
            raise
    
    def _init_llm(self):
        """Initialize the language model."""
        try:
            self.llm = ChatOpenAI(
                model_name=self.model_name,
                openai_api_key=self.openai_api_key,
                temperature=self.temperature,
                max_tokens=self.max_tokens
            )
            logger.info(f"Initialized LLM with model: {self.model_name}")
        except Exception as e:
            logger.error(f"Failed to initialize LLM: {str(e)}")
            raise
    
    def _init_qa_chain(self):
        """Initialize the QA chain."""
        try:
            # Create a retriever from the vector store
            retriever = self.vectorstore.as_retriever(
                search_type="similarity",
                search_kwargs={"k": 5}  # Retrieve top 5 most similar documents
            )
            
            # Get initial prompt from settings
            from chatbot_settings import get_settings
            settings = get_settings()
            initial_prompt = settings.get('initialPrompt', 
                "Anda adalah asisten AI untuk RSH Satu Bumi yang membantu menjawab pertanyaan tentang program kesehatan dan detoksifikasi.")
            
            logger.info(f"Using initial prompt from settings: {initial_prompt}")
            
            # Create a custom prompt template that includes the initial prompt
            template = f"""
            {initial_prompt}
            
            Gunakan informasi berikut untuk menjawab pertanyaan pengguna.
            Jika kamu tidak tahu jawabannya, katakan saja kamu tidak tahu dan sarankan untuk menghubungi RSH Satu Bumi secara langsung.
            Jangan mencoba membuat informasi yang tidak ada dalam konteks.
            
            Konteks:
            {{context}}
            
            Pertanyaan: {{question}}
            
            Jawaban:
            """
            
            prompt = PromptTemplate(
                template=template,
                input_variables=["context", "question"]
            )
            
            # Create the QA chain
            self.qa_chain = RetrievalQA.from_chain_type(
                llm=self.llm,
                chain_type="stuff",  # 'stuff' method: stuff all retrieved documents into the prompt
                retriever=retriever,
                chain_type_kwargs={"prompt": prompt},
                return_source_documents=True
            )
            
            logger.info("Initialized QA chain")
        except Exception as e:
            logger.error(f"Failed to initialize QA chain: {str(e)}")
            raise
    
    def generate_response(self, query: str) -> str:
        """
        Generate a response to the given query using the RAG pipeline.
        
        Args:
            query: The user's query
            
        Returns:
            The generated response
        """
        try:
            logger.info(f"Generating response for query: {query}")
            
            # Run the QA chain
            result = self.qa_chain({"query": query})
            
            # Extract the response and source documents
            response = result.get("result", "")
            source_docs = result.get("source_documents", [])
            
            # Log source documents for debugging
            if source_docs:
                logger.debug(f"Retrieved {len(source_docs)} source documents")
                for i, doc in enumerate(source_docs):
                    logger.debug(f"Source {i+1}: {doc.page_content[:100]}...")
            
            return response
        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            return f"Maaf, terjadi kesalahan dalam memproses pertanyaan Anda. Detail: {str(e)}"


# Example usage
if __name__ == "__main__":
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()
    
    # Set up logging
    logging.basicConfig(level=logging.INFO)
    
    # Initialize the RAG pipeline
    pipeline = RAGPipeline(
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        pinecone_api_key=os.getenv("PINECONE_API_KEY"),
        pinecone_environment=os.getenv("PINECONE_ENVIRONMENT"),
        index_name=os.getenv("PINECONE_INDEX_NAME", "rsh-chatbot-index")
    )
    
    # Test the pipeline
    query = "Apa itu program 7 hari menuju sehat raga & jiwa?"
    response = pipeline.generate_response(query)
    print(f"Query: {query}")
    print(f"Response: {response}")
