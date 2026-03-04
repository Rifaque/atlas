import urllib.request
import json
import lancedb
import os

url = "http://127.0.0.1:11434/api/embed"
data = json.dumps({
    "model": "llama3.2:latest",
    "input": ["what is rifaque's full name"]
}).encode("utf-8")

req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
query_embedding = None
try:
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read().decode())
        query_embedding = res.get("embeddings", [])[0]
        print(f"Generated query embedding, length: {len(query_embedding)}")
except Exception as e:
    print("Error embedding:", e)
    exit(1)

db_path = os.path.expanduser("~/.atlas/lancedb")
try:
    db = lancedb.connect(db_path)
    
    table_name = f"atlas_{len(query_embedding)}"
    try:
        table = db.open_table(table_name)
    except Exception as e:
        print(f"Table {table_name} not found! Error: {e}")
        exit(1)
        
    print(f"Searching {table_name} which has {table.count_rows()} rows...")
    
    # Run vector search
    results = table.search(query_embedding).limit(5).to_pandas()
    
    if len(results) == 0:
        print("No matches returned.")
    else:
        for idx, row in results.iterrows():
            dist = row['_distance']
            doc = row['document'][:100].replace('\n', '\\n')
            filepath = row['filePath']
            print(f"Match [{dist:.4f}]: {filepath} -> {doc}")
            
except Exception as e:
    print(f"Error searching LanceDB: {e}")
    import traceback
    traceback.print_exc()
