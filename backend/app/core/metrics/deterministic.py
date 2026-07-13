import re
import string
from collections import Counter
from typing import Dict
from rouge_score import rouge_scorer

def normalize_text(text: str) -> str:
    """Lowercases, removes punctuation, articles, and extra whitespace to normalize answers."""
    def remove_articles(text_str):
        return re.sub(r'\b(a|an|the)\b', ' ', text_str)

    def white_space_fix(text_str):
        return ' '.join(text_str.split())

    def remove_punc(text_str):
        exclude = set(string.punctuation)
        return ''.join(ch for ch in text_str if ch not in exclude)

    return white_space_fix(remove_articles(remove_punc(text.lower())))

def compute_exact_match(prediction: str, ground_truth: str) -> float:
    """Computes exact match score (1.0 if identical normalized text, else 0.0)."""
    return float(normalize_text(prediction) == normalize_text(ground_truth))

def compute_f1(prediction: str, ground_truth: str) -> float:
    """Computes token-level F1 score between prediction and ground truth."""
    pred_tokens = normalize_text(prediction).split()
    gt_tokens = normalize_text(ground_truth).split()
    
    if not pred_tokens or not gt_tokens:
        return float(pred_tokens == gt_tokens)
        
    common = Counter(pred_tokens) & Counter(gt_tokens)
    num_same = sum(common.values())
    
    if num_same == 0:
        return 0.0
        
    precision = 1.0 * num_same / len(pred_tokens)
    recall = 1.0 * num_same / len(gt_tokens)
    f1 = (2 * precision * recall) / (precision + recall)
    return f1

def compute_rouge_l(prediction: str, ground_truth: str) -> float:
    """Computes ROUGE-L F-measure score between prediction and ground truth."""
    if not prediction.strip() or not ground_truth.strip():
        return 0.0
    scorer = rouge_scorer.RougeScorer(['rougeL'], use_stemmer=True)
    scores = scorer.score(ground_truth, prediction)
    return scores['rougeL'].fmeasure

def compute_deterministic_metrics(prediction: str, ground_truth: str) -> Dict[str, float]:
    """Computes all deterministic/reference-based metrics."""
    return {
        "exact_match": compute_exact_match(prediction, ground_truth),
        "f1_score": compute_f1(prediction, ground_truth),
        "rouge_l": compute_rouge_l(prediction, ground_truth)
    }

if __name__ == "__main__":
    # Test execution
    pred = "CloudScale build containers have a default limit of 2GB of RAM."
    gold = "By default, CloudScale build containers are allocated 2GB of RAM."
    print("Metrics:", compute_deterministic_metrics(pred, gold))
