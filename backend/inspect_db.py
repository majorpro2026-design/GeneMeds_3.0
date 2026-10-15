from app.database import engine
from sqlalchemy import text

def inspect_db():
    with engine.connect() as conn:
        schemas = conn.execute(text("SELECT schema_name FROM information_schema.schemata ORDER BY schema_name")).fetchall()
        print("=== SCHEMAS ===")
        for s in schemas:
            print(f"- {s[0]}")

        tables = conn.execute(text("""
            SELECT table_schema, table_name, table_type 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name
        """)).fetchall()
        print("\n=== TABLES & ROW COUNTS ===")
        for t in tables:
            schema, table_name, ttype = t[0], t[1], t[2]
            try:
                count = conn.execute(text(f'SELECT count(*) FROM "{schema}"."{table_name}"')).scalar()
                print(f"{schema}.{table_name} ({ttype}): {count} rows")
            except Exception as e:
                print(f"{schema}.{table_name} ({ttype}): count error: {e}")

        print("\n=== INDEXES ON KNOWLEDGE & CORE & HISTORY ===")
        indexes = conn.execute(text("""
            SELECT schemaname, tablename, indexname, indexdef
            FROM pg_indexes
            WHERE schemaname IN ('knowledge', 'core', 'history', 'public')
            ORDER BY schemaname, tablename, indexname
        """)).fetchall()
        for idx in indexes:
            print(f"{idx[0]}.{idx[1]} -> {idx[2]}: {idx[3]}")

if __name__ == "__main__":
    inspect_db()
