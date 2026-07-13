from typing import Dict

# Pricing per 1,000,000 tokens in USD
PRICING_TABLE = {
    "openai": {
        "gpt-4o-mini": {"in": 0.15, "out": 0.60},
        "gpt-4o": {"in": 2.50, "out": 10.00},
        "gpt-4": {"in": 30.00, "out": 60.00},
        "gpt-3.5-turbo": {"in": 0.50, "out": 1.50},
    },
    "anthropic": {
        "claude-3-5-sonnet": {"in": 3.00, "out": 15.00},
        "claude-3-haiku": {"in": 0.25, "out": 1.25},
        "claude-3-opus": {"in": 15.00, "out": 75.00},
    },
    "ollama": {
        "llama3": {"in": 0.0, "out": 0.0},
        "mistral": {"in": 0.0, "out": 0.0},
        "phi3": {"in": 0.0, "out": 0.0},
    },
    "mock": {
        "mock-model": {"in": 0.0, "out": 0.0}
    }
}

def calculate_token_cost(provider: str, model: str, tokens_in: int, tokens_out: int) -> float:
    """Calculates the dollar cost of the API call based on provider, model, and token count.
    
    If the provider/model combination is not listed in the pricing table, it falls back
    to 0.0 cost.
    """
    provider_key = provider.lower()
    model_key = model.lower().replace("ollama/", "")
    
    # Resolve provider/model pricing
    provider_pricing = PRICING_TABLE.get(provider_key)
    if not provider_pricing:
        # Check if we can find the model name in any provider list
        for p_key, models in PRICING_TABLE.items():
            if model_key in models:
                provider_pricing = models
                break
                
    if not provider_pricing:
        return 0.0
        
    model_pricing = provider_pricing.get(model_key, {"in": 0.0, "out": 0.0})
    
    cost_in = (tokens_in / 1_000_000.0) * model_pricing["in"]
    cost_out = (tokens_out / 1_000_000.0) * model_pricing["out"]
    
    return cost_in + cost_out
