import os
import time
from typing import List, Dict, Any
from backend.app.config import settings
from backend.app.system_under_test.retriever import FAQRetriever
from backend.app.core.metrics.cost import calculate_token_cost

class RAGChatbot:
    def __init__(self, retriever: FAQRetriever | None = None):
        self.retriever = retriever or FAQRetriever()
        
        # Initialize LLM clients if keys are present
        self.openai_client = None
        self.anthropic_client = None
        self.hf_client = None
        
        if settings.OPENAI_API_KEY:
            try:
                from openai import OpenAI
                self.openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
            except ImportError:
                print("OpenAI library not installed, fallback enabled.")
            
        if settings.ANTHROPIC_API_KEY:
            try:
                from anthropic import Anthropic
                self.anthropic_client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            except ImportError:
                print("Anthropic library not installed, fallback enabled.")
                
        if settings.HUGGINGFACE_API_KEY:
            try:
                from huggingface_hub import InferenceClient
                self.hf_client = InferenceClient(api_key=settings.HUGGINGFACE_API_KEY)
            except ImportError:
                print("Hugging Face library not installed, fallback enabled.")

    def generate_response(self, query: str, retrieved_contexts: List[str], model: str = None) -> Dict[str, Any]:
        """Generates an answer based on query and retrieved contexts using the specified LLM."""
        model = model or settings.SUT_MODEL
        context_str = "\n---\n".join(retrieved_contexts)
        
        system_prompt = (
            "You are an expert customer support agent for CloudScale, a SaaS platform. "
            "Your task is to answer the user's question accurately using ONLY the reference context provided below.\n\n"
            "Reference Context:\n"
            f"{context_str}\n\n"
            "Instructions:\n"
            "1. Base your answer strictly on the reference context. If the answer cannot be found in the context, "
            "respond with: 'I am sorry, but I do not have that information in my database.'\n"
            "2. Be concise, polite, and helpful.\n"
            "3. Do not make up any facts or details not present in the context."
        )
        
        start_time = time.time()
        answer = ""
        provider = "mock"
        tokens_in = 0
        tokens_out = 0
        
        try:
            # 1. Check if we should use OpenAI
            if model.startswith("gpt-") and self.openai_client:
                provider = "openai"
                response = self.openai_client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": query}
                    ],
                    temperature=0.0
                )
                answer = response.choices[0].message.content.strip()
                tokens_in = response.usage.prompt_tokens
                tokens_out = response.usage.completion_tokens
                
            # 2. Check if we should use Anthropic
            elif model.startswith("claude-") and self.anthropic_client:
                provider = "anthropic"
                response = self.anthropic_client.messages.create(
                    model=model,
                    max_tokens=1024,
                    temperature=0.0,
                    system=system_prompt,
                    messages=[
                        {"role": "user", "content": query}
                    ]
                )
                answer = response.content[0].text.strip()
                tokens_in = response.usage.input_tokens
                tokens_out = response.usage.output_tokens
                
            # 3. Check if we should use Hugging Face
            elif model.startswith("hf/") and self.hf_client:
                provider = "huggingface"
                hf_model = model[3:]
                response = self.hf_client.chat_completion(
                    model=hf_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": query}
                    ],
                    temperature=0.1,
                    max_tokens=1024
                )
                answer = response.choices[0].message.content.strip()
                # Estimate tokens for free-tier HF API
                tokens_in = int(len((system_prompt + query).split()) * 1.3)
                tokens_out = int(len(answer.split()) * 1.3)
                
            # 4. Check if we should use Ollama (local) or fallback if keys are missing
            elif model.startswith("ollama/") or (not self.openai_client and not self.anthropic_client and not self.hf_client):
                provider = "ollama"
                ollama_model = model.replace("ollama/", "") if model.startswith("ollama/") else "llama3"
                
                # Check if we can reach Ollama, else fallback to mock
                import requests
                try:
                    payload = {
                        "model": ollama_model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": query}
                        ],
                        "stream": False,
                        "options": {"temperature": 0.0}
                    }
                    res = requests.post(f"{settings.OLLAMA_BASE_URL}/api/chat", json=payload, timeout=5)
                    if res.status_code == 200:
                        data = res.json()
                        answer = data["message"]["content"].strip()
                        tokens_in = data.get("prompt_eval_count", 0)
                        tokens_out = data.get("eval_count", 0)
                    else:
                        raise Exception(f"Ollama returned status {res.status_code}")
                except Exception:
                    # Local fallback: Extract answer from matched context if available, to support offline dev
                    provider = "mock"
                    if retrieved_contexts:
                        # Extract the answer part from the first context chunk
                        first_chunk = retrieved_contexts[0]
                        if "Answer:" in first_chunk:
                            answer = first_chunk.split("Answer:")[1].strip()
                        else:
                            answer = f"[Mock Fallback Answer] based on context: {first_chunk[:100]}..."
                    else:
                        answer = "I am sorry, but I do not have that information in my database."
                    tokens_in = 0
                    tokens_out = 0
            
            else:
                raise ValueError("No valid LLM client configured and model did not match Ollama.")
                
        except Exception as e:
            # Final safety fallback
            print(f"Error in LLM Generation: {e}. Falling back to default parser response.")
            provider = f"fallback-{provider}"
            if retrieved_contexts:
                first_chunk = retrieved_contexts[0]
                if "Answer:" in first_chunk:
                    answer = first_chunk.split("Answer:")[1].strip()
                else:
                    answer = f"Based on our documents: {first_chunk[:150]}..."
            else:
                answer = "I am sorry, but I do not have that information in my database."
            tokens_in = 0
            tokens_out = 0

        latency = time.time() - start_time
        
        # Calculate cost
        cost = calculate_token_cost(provider, model, tokens_in, tokens_out)
        
        return {
            "query": query,
            "answer": answer,
            "provider": provider,
            "model": model,
            "latency_seconds": latency,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "cost_usd": cost,
            "retrieved_contexts": retrieved_contexts
        }


    def query(self, user_query: str, top_k: int = 3) -> Dict[str, Any]:
        """Runs the complete RAG loop: retrieve relevant chunks, then generate answer."""
        retrieved_docs = self.retriever.retrieve(user_query, top_k=top_k)
        contexts = [doc["text"] for doc in retrieved_docs]
        response = self.generate_response(user_query, contexts)
        # Add retriever source mapping
        response["sources"] = [{"id": doc["id"], "metadata": doc["metadata"]} for doc in retrieved_docs]
        return response

if __name__ == "__main__":
    # Test end-to-end query
    chatbot = RAGChatbot()
    test_query = "What is the SLA for production Postgres databases?"
    print(f"\nUser: {test_query}")
    result = chatbot.query(test_query)
    print(f"\nResponse (via {result['provider']} - {result['model']}):")
    print(result["answer"])
    print(f"\nStats: Latency={result['latency_seconds']:.2f}s, In-tokens={result['tokens_in']}, Out-tokens={result['tokens_out']}, Cost=${result['cost_usd']:.6f}")
    print("\nSources:")
    for src in result["sources"]:
        print(f"- {src['id']}: {src['metadata']['question']}")
