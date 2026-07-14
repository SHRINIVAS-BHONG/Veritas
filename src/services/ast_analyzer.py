import ast
import os
from typing import List, Dict, Set

# List of known LLM/AI related libraries
LLM_LIBRARIES = {
    "langchain",
    "langchain_core",
    "openai",
    "google.generativeai",
    "google",
    "anthropic",
    "chromadb",
    "pinecone",
    "transformers",
    "qdrant_client",
    "llama_index",
    "cohere",
    "tiktoken"
}

class LLMImportVisitor(ast.NodeVisitor):
    def __init__(self):
        self.detected_libraries: Set[str] = set()

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            base_module = alias.name.split('.')[0]
            if base_module in LLM_LIBRARIES or alias.name in LLM_LIBRARIES:
                self.detected_libraries.add(alias.name)
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        if node.module:
            base_module = node.module.split('.')[0]
            if base_module in LLM_LIBRARIES or node.module in LLM_LIBRARIES:
                self.detected_libraries.add(node.module)
        self.generic_visit(node)

def analyze_file(filepath: str) -> List[str]:
    """Parses a single Python file and returns detected LLM libraries."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        
        tree = ast.parse(content, filename=filepath)
        visitor = LLMImportVisitor()
        visitor.visit(tree)
        return list(visitor.detected_libraries)
    except Exception:
        # Ignore syntax errors in target files, return empty
        return []

def analyze_directory(directory_path: str) -> Dict[str, List[str]]:
    """
    Recursively scans a directory for Python files and identifies LLM library usage.
    Returns a dictionary mapping file paths to lists of detected libraries.
    """
    results = {}
    for root, _, files in os.walk(directory_path):
        for file in files:
            if file.endswith(".py"):
                full_path = os.path.join(root, file)
                detected = analyze_file(full_path)
                if detected:
                    # Store relative path for cleaner output
                    rel_path = os.path.relpath(full_path, directory_path)
                    results[rel_path] = detected
    return results
