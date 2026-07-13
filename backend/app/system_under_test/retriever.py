import os
import re
from typing import List, Dict, Any
# pyrefly: ignore [missing-import]
import chromadb
# pyrefly: ignore [missing-import]
from chromadb.utils import embedding_functions

# Path configurations
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "app", "system_under_test", "data")
FAQ_PATH = os.path.join(DATA_DIR, "cloudscale_faq.md")
CHROMA_PATH = os.path.join(BASE_DIR, "chroma_db")

class FAQRetriever:
    def __init__(self, db_path: str = CHROMA_PATH):
        self.db_path = db_path
        # Initialize persistent Chroma client
        self.client = chromadb.PersistentClient(path=self.db_path)
        
        # Use sentence-transformers for local embeddings
        self.embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        
        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name="cloudscale_faq",
            embedding_function=self.embedding_function
        )
        
        # If the collection is empty, populate it
        if self.collection.count() == 0:
            self._populate_db()

    def _parse_faq_markdown(self, filepath: str) -> List[Dict[str, Any]]:
        """Parses the FAQ markdown file into individual Q&A blocks."""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"FAQ file not found at {filepath}")
            
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        # Split by H3 headers starting with "### Q:"
        # We split on H3 headers, capturing the questions
        chunks = []
        sections = re.split(r'\n(### Q:.*)\n', content)
        
        # The split returns: [text before first H3, H3_1, text_after_H3_1, H3_2, text_after_H3_2, ...]
        # We start from index 1 and step by 2
        for i in range(1, len(sections), 2):
            q_header = sections[i].strip()
            answer_body = sections[i+1].strip() if i+1 < len(sections) else ""
            
            # Extract question text from "### Q: Question text"
            q_match = re.match(r'### Q:\s*(.*)', q_header)
            question = q_match.group(1).strip() if q_match else q_header
            
            # Combine question and answer for vector embedding search
            full_text = f"Question: {question}\nAnswer: {answer_body}"
            
            chunks.append({
                "text": full_text,
                "metadata": {
                    "source": os.path.basename(filepath),
                    "question": question
                }
            })
            
        return chunks

    def _populate_db(self):
        """Loads and parses the FAQ markdown, and adds chunks to vector DB."""
        print("Populating vector database with FAQ data...")
        try:
            chunks = self._parse_faq_markdown(FAQ_PATH)
            
            documents = []
            metadatas = []
            ids = []
            
            for idx, chunk in enumerate(chunks):
                documents.append(chunk["text"])
                metadatas.append(chunk["metadata"])
                ids.append(f"faq_{idx}")
                
            if documents:
                self.collection.add(
                    documents=documents,
                    metadatas=metadatas,
                    ids=ids
                )
                print(f"Successfully indexed {len(documents)} FAQ documents.")
        except Exception as e:
            print(f"Error populating database: {e}")

    def retrieve(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """Queries the vector DB and returns matching documents and metadata."""
        results = self.collection.query(
            query_texts=[query],
            n_results=top_k
        )
        
        retrieved_docs = []
        if results and "documents" in results and results["documents"]:
            # Format results
            documents = results["documents"][0]
            metadatas = results["metadatas"][0]
            distances = results["distances"][0] if "distances" in results else [0.0] * len(documents)
            ids = results["ids"][0]
            
            for i in range(len(documents)):
                retrieved_docs.append({
                    "id": ids[i],
                    "text": documents[i],
                    "metadata": metadatas[i],
                    "distance": distances[i]
                })
                
        return retrieved_docs

if __name__ == "__main__":
    # Test execution
    retriever = FAQRetriever()
    test_query = "How do I change from monthly to annual billing?"
    print(f"\nTesting retrieval for query: '{test_query}'")
    results = retriever.retrieve(test_query, top_k=2)
    for r in results:
        print(f"\nID: {r['id']} (Distance: {r['distance']:.4f})")
        print(f"Content:\n{r['text']}")
