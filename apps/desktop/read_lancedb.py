import lancedb
import os

db_path = os.path.expanduser("~/.atlas/lancedb")
with open("lancedb_out.txt", "w") as f:
    f.write(f"Opening DB at {db_path}\n")
    try:
        db = lancedb.connect(db_path)
        tables = db.table_names()
        f.write(f"Tables found: {tables}\n")
        
        for t in tables:
            if t.startswith("atlas_"):
                try:
                    table = db.open_table(t)
                    f.write(f"--- Table {t} --- Rows: {table.count_rows()}\n")
                except Exception as e:
                    f.write(f"Error opening {t}: {e}\n")
    except Exception as e:
        f.write(f"Error: {e}\n")
