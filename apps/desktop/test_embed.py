import urllib.request
import json

url = "http://127.0.0.1:11434/api/embed"
data = json.dumps({
    "model": "llama3.2:latest",
    "input": ["hello world"]
}).encode("utf-8")

req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read().decode())
        embeddings = res.get("embeddings", [])
        if embeddings:
            print("Dimension:", len(embeddings[0]))
        else:
            print("No embeddings returned")
except Exception as e:
    print("Error:", e)
