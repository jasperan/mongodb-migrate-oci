import requests
import json

class OllamaClient:
    def __init__(self, endpoint):
        self.endpoint = endpoint

    def generate(self, prompt, **kwargs):
        payload = {"prompt": prompt}
        payload.update(kwargs)
        resp = requests.post(self.endpoint, json=payload, stream=True)
        responses = []
        try:
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
            # fallback: try single JSON
            return resp.json().get("response", "")
        except Exception:
            return resp.text

    def generate_old(self, prompt, **kwargs):
        payload = {"prompt": prompt}
        payload.update(kwargs)
        resp = requests.post(self.endpoint, json=payload)
        resp.raise_for_status()
        return resp.json().get("response", "") 