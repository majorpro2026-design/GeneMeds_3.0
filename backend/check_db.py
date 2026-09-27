import sys
from pathlib import Path
from sqlalchemy import text

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import engine

def main():
    with engine.connect() as conn:
        tables = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='core'")).fetchall()
        print("Existing core tables:", [t[0] for t in tables])
        
        for table in ["patient_prescription", "prescription_item"]:
            cols = conn.execute(text(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='core' AND table_name='{table}'")).fetchall()
            print(f"Columns for core.{table}:", cols)

if __name__ == "__main__":
    main()
