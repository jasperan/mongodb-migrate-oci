import requests
import json

class OllamaClient:
    """
    Client for interacting with the Ollama API.
    Handles both streaming and non-streaming text generation requests.
    """
    def __init__(self, endpoint):
        # Store the Ollama API endpoint URL for making requests
        self.endpoint = endpoint

    def generate(self, prompt, **kwargs):
        """
        Generate text using **streaming** response from Ollama API.
        Falls back to non-streaming if streaming fails.
        
        Args:
            prompt (str): The input prompt for generation
            **kwargs: Additional parameters to pass to the API
            
        Returns:
            str: Generated text response
        """
        payload = {"prompt": prompt}
        payload.update(kwargs)
        resp = requests.post(self.endpoint, json=payload, stream=True)
        responses = []
        try:
            # Process streaming response line by line
            for line in resp.iter_lines():
                if not line:
                    continue
                try:
                    obj = json.loads(line.decode('utf-8'))
                    if 'response' in obj:
                        responses.append(obj['response'])
                except Exception:
                    continue
            if responses:
                return ''.join(responses)
            # fallback: try single JSON response if streaming fails
            return resp.json().get("response", "")
        except Exception:
            return resp.text

    def generate_old(self, prompt, **kwargs):
        """
        Legacy non-streaming text generation method.
        Uses simple request/response pattern.
        
        Args:
            prompt (str): The input prompt for generation
            **kwargs: Additional parameters to pass to the API
            
        Returns:
            str: Generated text response
        """
        payload = {"prompt": prompt}
        payload.update(kwargs)
        resp = requests.post(self.endpoint, json=payload)
        resp.raise_for_status()
        return resp.json().get("response", "")