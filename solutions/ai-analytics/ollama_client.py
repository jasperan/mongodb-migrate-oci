import os
import requests
import json

class OllamaClient:
    """
    Client for interacting with the Ollama API.
    Handles both streaming and non-streaming text generation requests.
    """
    def __init__(self, endpoint):
        # Allow environment variable override
        self.endpoint = os.getenv("OLLAMA_ENDPOINT", endpoint)
        # Default timeouts (connect, read)
        self.timeout = (5, 60)

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
        try:
            resp = requests.post(self.endpoint, json=payload, stream=True, timeout=self.timeout)
        except requests.exceptions.RequestException as exc:
            return f"[Ollama error] {type(exc).__name__}: {exc}"
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
        resp = requests.post(self.endpoint, json=payload, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json().get("response", "")

    def health(self):
        """Basic health check against Ollama /api/version."""
        try:
            base = self.endpoint.split("/api/")[0]
            r = requests.get(f"{base}/api/version", timeout=(3, 5))
            if r.ok:
                return {"ok": True, "version": r.text}
            return {"ok": False, "status": r.status_code}
        except requests.exceptions.RequestException as exc:
            return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}