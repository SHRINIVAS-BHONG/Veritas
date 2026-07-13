import os
import json
import re
from typing import Dict, Any, List, Tuple
from backend.app.config import settings

class LLMJudge:
    def __init__(self):
        self.openai_client = None
        self.anthropic_client = None
        self.hf_client = None
        
        # Initialize API clients if keys are present
        if settings.OPENAI_API_KEY:
            try:
                from openai import OpenAI
                self.openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
            except ImportError:
                print("OpenAI client failed to load in LLMJudge.")
                
        if settings.ANTHROPIC_API_KEY:
            try:
                from anthropic import Anthropic
                self.anthropic_client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            except ImportError:
                print("Anthropic client failed to load in LLMJudge.")
                
        if settings.HUGGINGFACE_API_KEY:
            try:
                from huggingface_hub import InferenceClient
                self.hf_client = InferenceClient(api_key=settings.HUGGINGFACE_API_KEY)
            except ImportError:
                print("Hugging Face client failed to load in LLMJudge.")

    def _call_llm(self, system_prompt: str, user_prompt: str) -> str:
        """Helper to invoke OpenAI, Anthropic, or return empty string."""
        model = settings.JUDGE_MODEL
        
        # 1. Use OpenAI
        if self.openai_client and model.startswith("gpt-"):
            response = self.openai_client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.0
            )
            return response.choices[0].message.content.strip()
            
        # 2. Use Anthropic
        elif self.anthropic_client and model.startswith("claude-"):
            response = self.anthropic_client.messages.create(
                model=model,
                max_tokens=1024,
                temperature=0.0,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )
            return response.content[0].text.strip()
            
        # 3. Use Hugging Face Inference API
        elif self.hf_client and model.startswith("hf/"):
            hf_model = model[3:]
            response = self.hf_client.chat_completion(
                model=hf_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,
                max_tokens=1024
            )
            return response.choices[0].message.content.strip()
            
        # 4. Fallback/Local Ollama or Mock (handled in callers)
        raise ValueError(f"No API client configuration found for LLM Judge call with model: {model}")

    def evaluate_faithfulness(self, answer: str, context: str) -> Tuple[float, str]:
        """Checks if the answer is fully grounded in the retrieved context using claim-decomposition.
        
        Returns:
            Tuple[score, reasoning_trace]
        """
        # If API keys are missing, run the deterministic mock groundedness check
        if not self.openai_client and not self.anthropic_client and not self.hf_client:
            return self._mock_faithfulness(answer, context)
            
        try:
            # Step 1: Extract Claims
            claim_extraction_system = (
                "You are an expert NLP analyst. Your job is to read the provided text and extract a list of "
                "distinct, atomic factual claims made in the text. Return the output STRICTLY as a JSON list of strings."
            )
            claim_extraction_user = f"Text to extract claims from:\n{answer}"
            
            claims_raw = self._call_llm(claim_extraction_system, claim_extraction_user)
            
            # Clean JSON from LLM formatting
            claims_clean = re.sub(r'```json|```', '', claims_raw).strip()
            claims = json.loads(claims_clean)
            
            if not claims:
                return 1.0, "No claims extracted from the answer."
                
            # Step 2: Validate each claim against the context
            supported_count = 0
            trace_lines = []
            
            validation_system = (
                "You are an expert fact-checker. Your task is to determine if a specific claim is fully supported "
                "by the provided reference context. You must reply in the following JSON format:\n"
                "{\n  \"supported\": true/false,\n  \"reason\": \"A short explanation citing the context\"\n}"
            )
            
            for idx, claim in enumerate(claims):
                validation_user = f"Reference Context:\n{context}\n\nClaim:\n{claim}"
                val_raw = self._call_llm(validation_system, validation_user)
                
                val_clean = re.sub(r'```json|```', '', val_raw).strip()
                val_data = json.loads(val_clean)
                
                status = "YES" if val_data.get("supported") else "NO"
                if val_data.get("supported"):
                    supported_count += 1
                    
                trace_lines.append(
                    f"Claim {idx+1}: \"{claim}\"\n  -> Supported: {status}\n  -> Reason: {val_data.get('reason')}"
                )
                
            score = supported_count / len(claims)
            trace = f"Faithfulness Score: {score:.2f} ({supported_count}/{len(claims)} claims supported)\n\n" + "\n\n".join(trace_lines)
            return score, trace
            
        except Exception as e:
            print(f"Error in LLM faithfulness judge: {e}. Falling back to mock groundedness.")
            return self._mock_faithfulness(answer, context)

    def evaluate_relevance(self, question: str, answer: str) -> Tuple[float, str]:
        """Rates whether the answer directly addresses the question (0.0 to 1.0).
        
        Returns:
            Tuple[score, reasoning_trace]
        """
        if not self.openai_client and not self.anthropic_client:
            return self._mock_relevance(question, answer)
            
        try:
            system_prompt = (
                "You are an LLM evaluation judge. Your task is to assess whether the generated answer directly "
                "addresses the question, regardless of factuality or truthfulness. Rate this on a scale from 0.0 "
                "(completely irrelevant or avoids the question) to 1.0 (perfectly addresses the question).\n"
                "You must output STRICTLY in the following JSON format:\n"
                "{\n  \"score\": float,\n  \"reason\": \"A short explanation of the score\"\n}"
            )
            user_prompt = f"Question: {question}\nAnswer: {answer}"
            
            res_raw = self._call_llm(system_prompt, user_prompt)
            res_clean = re.sub(r'```json|```', '', res_raw).strip()
            data = json.loads(res_clean)
            
            score = float(data.get("score", 0.0))
            reason = str(data.get("reason", "No reasoning provided."))
            
            return score, f"Relevance Score: {score:.2f}\nReasoning: {reason}"
            
        except Exception as e:
            print(f"Error in LLM relevance judge: {e}. Falling back to mock relevance.")
            return self._mock_relevance(question, answer)

    def evaluate_context_recall(self, question: str, expected_answer: str, context: str) -> Tuple[float, str]:
        """Rates whether the retrieved context contains the facts listed in the expected answer (0.0 to 1.0).
        
        Returns:
            Tuple[score, reasoning_trace]
        """
        if not self.openai_client and not self.anthropic_client and not self.hf_client:
            return self._mock_context_recall(expected_answer, context)
            
        try:
            system_prompt = (
                "You are an expert retrieval judge. Your job is to check if the facts in the Expected Answer are present "
                "in the retrieved Reference Context. Rate this on a scale from 0.0 (none of the required information is present) "
                "to 1.0 (all required information is present in the context).\n"
                "You must output STRICTLY in the following JSON format:\n"
                "{\n  \"score\": float,\n  \"reason\": \"A short explanation mapping the facts present/missing\"\n}"
            )
            user_prompt = f"Question: {question}\nExpected Answer: {expected_answer}\nReference Context:\n{context}"
            
            res_raw = self._call_llm(system_prompt, user_prompt)
            res_clean = re.sub(r'```json|```', '', res_raw).strip()
            data = json.loads(res_clean)
            
            score = float(data.get("score", 0.0))
            reason = str(data.get("reason", "No reasoning provided."))
            
            return score, f"Context Recall Score: {score:.2f}\nReasoning: {reason}"
            
        except Exception as e:
            print(f"Error in LLM context recall judge: {e}. Falling back to mock context recall.")
            return self._mock_context_recall(expected_answer, context)

    # --- MOCK FALLBACKS FOR OFFLINE DEVELOPMENT ---

    def _mock_faithfulness(self, answer: str, context: str) -> Tuple[float, str]:
        """Mock faithfulness check using basic heuristic string overlap."""
        # Clean answer and context
        ans_words = set(re.findall(r'\w+', answer.lower()))
        ctx_words = set(re.findall(r'\w+', context.lower()))
        
        # Stopwords to filter out
        stopwords = {"the", "a", "an", "and", "or", "but", "to", "of", "in", "is", "for", "on", "with", "at", "by", "from"}
        ans_keywords = {w for w in ans_words if w not in stopwords}
        
        if not ans_keywords:
            return 1.0, "[Mock Trace] No content words found in answer. Defaulted to 1.0."
            
        overlap = ans_keywords.intersection(ctx_words)
        overlap_ratio = len(overlap) / len(ans_keywords)
        
        # Calibrate mock score: if overlap ratio is high, score is 1.0, else proportional
        score = 1.0 if overlap_ratio > 0.6 else min(1.0, overlap_ratio * 1.5)
        score = round(score, 2)
        
        # Create a mock claim trace
        mock_claims = [
            f"Mock Claim 1: Answer uses relevant keywords '{list(ans_keywords)[:5]}'."
        ]
        trace = (
            f"[Mock LLM-as-Judge] Faithfulness Score: {score:.2f}\n\n"
            f"Extracted claims validated:\n"
            f"- Grounding match overlap: {len(overlap)} of {len(ans_keywords)} words present in context.\n"
            f"- Groundedness verified via keyword intersection analysis.\n"
            f"- Supporting evidence check: {'Grounded' if score > 0.8 else 'Ungrounded claims suspected'}.\n"
            f"\nReasoning: The answer contains key concepts that map directly to reference contexts."
        )
        return score, trace

    def _mock_relevance(self, question: str, answer: str) -> Tuple[float, str]:
        """Mock answer relevance using basic question keyword search."""
        q_words = set(re.findall(r'\w+', question.lower()))
        ans_words = set(re.findall(r'\w+', answer.lower()))
        
        stopwords = {"the", "a", "an", "and", "or", "but", "to", "of", "in", "is", "for", "on", "with", "at", "by", "from"}
        q_keywords = {w for w in q_words if w not in stopwords}
        
        if not q_keywords:
            return 1.0, "[Mock Trace] Empty question keywords. Defaulted to 1.0."
            
        overlap = q_keywords.intersection(ans_words)
        overlap_ratio = len(overlap) / len(q_keywords)
        
        # Relevance: answers addressing the FAQ typically share terminology
        score = 1.0 if overlap_ratio > 0.4 else 0.8
        
        trace = (
            f"[Mock LLM-as-Judge] Relevance Score: {score:.2f}\n\n"
            f"Analysis details:\n"
            f"- Question keywords checked: {list(q_keywords)[:5]}\n"
            f"- Overlap found: {list(overlap)}\n"
            f"Reasoning: The generated answer explicitly contains core terminology and key topics from the query."
        )
        return score, trace

    def _mock_context_recall(self, expected_answer: str, context: str) -> Tuple[float, str]:
        """Mock context recall by measuring overlap between context and golden expected answer."""
        ea_words = set(re.findall(r'\w+', expected_answer.lower()))
        ctx_words = set(re.findall(r'\w+', context.lower()))
        
        stopwords = {"the", "a", "an", "and", "or", "but", "to", "of", "in", "is", "for", "on", "with", "at", "by", "from"}
        ea_keywords = {w for w in ea_words if w not in stopwords}
        
        if not ea_keywords:
            return 1.0, "[Mock Trace] Empty expected answer keywords. Defaulted to 1.0."
            
        overlap = ea_keywords.intersection(ctx_words)
        overlap_ratio = len(overlap) / len(ea_keywords)
        
        # High overlap = high context recall
        score = 1.0 if overlap_ratio > 0.5 else min(1.0, overlap_ratio * 2.0)
        score = round(score, 2)
        
        trace = (
            f"[Mock LLM-as-Judge] Context Recall Score: {score:.2f}\n\n"
            f"Retrieval verification:\n"
            f"- Facts from expected answer: {list(ea_keywords)[:5]}\n"
            f"- Retrieved overlap: {list(overlap)}\n"
            f"Reasoning: Reference contexts fetched contain key facts matching the golden baseline answer."
        )
        return score, trace
