import json
import sys
import time
import requests
from dotenv import load_dotenv

load_dotenv()

sys.stdout.reconfigure(line_buffering=True)

DB_HOST = "genemeds.cupgeqgu0vg9.us-east-1.rds.amazonaws.com"
DB_PORT = 5432
DB_NAME = "genemeds"
DB_SCHEMA = "knowledge"
DB_USER = "postgres"
DB_PASSWORD = "genemedsdatabase"

RXNAV_BASE = "https://rxnav.nlm.nih.gov/REST"
REQUEST_SLEEP = 0.3

def log(msg):
    print(msg, flush=True)

def get_db_connection():
    import pg8000.native as pg8000
    import ssl
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE
    conn = pg8000.Connection(
        host=DB_HOST, port=DB_PORT, database=DB_NAME,
        user=DB_USER, password=DB_PASSWORD,
        timeout=10, ssl_context=ssl_ctx,
    )
    log(f"Connected to {DB_HOST}:{DB_PORT}/{DB_NAME}")
    return conn

def rxnav_get(path, params=None):
    r = requests.get(f"{RXNAV_BASE}/{path}", params=params, timeout=15)
    r.raise_for_status()
    return r.json()

def get_rxcui_for_brand(brand_name):
    try:
        data = rxnav_get("rxcui.json", {"name": brand_name, "search": "1"})
        ids = data.get("idGroup", {}).get("rxnormId", [])
        return ids[0] if ids else None
    except Exception as e:
        log(f"    WARNING: RxCUI lookup failed for '{brand_name}': {e}")
        return None

def get_real_ingredients(rxcui):
    try:
        data = rxnav_get(f"rxcui/{rxcui}/related.json", {"tty": "IN"})
        groups = data.get("relatedGroup", {}).get("conceptGroup", [])
        ingredients = []
        for group in groups:
            if group.get("tty") == "IN":
                for concept in group.get("conceptProperties", []):
                    ingredients.append(concept["name"].lower().strip())
        return ingredients
    except Exception as e:
        log(f"    WARNING: ingredient lookup failed for RxCUI {rxcui}: {e}")
        return []

def get_existing_pairs(conn):
    rows = conn.run(f"SELECT brand_name, generic_name FROM {DB_SCHEMA}.drug_brand_generic")
    existing = {}
    for brand, generic in rows:
        existing.setdefault(brand, set()).add(generic.lower().strip())
    return existing

def insert_missing_pair(conn, brand_name, generic_name):
    conn.run(
        f"""INSERT INTO {DB_SCHEMA}.drug_brand_generic (brand_name, generic_name)
            VALUES (:brand, :generic)
            ON CONFLICT (brand_name, generic_name) DO NOTHING""",
        brand=brand_name, generic=generic_name,
    )

def run():
    conn = get_db_connection()
    existing = get_existing_pairs(conn)
    brands = sorted(existing.keys())
    log(f"Checking {len(brands)} distinct brand names against live RxNorm data")
    total_checked = 0
    total_gaps_found = 0
    total_inserted = 0
    brands_not_found_in_rxnorm = []
    try:
        for i, brand in enumerate(brands, 1):
            rxcui = get_rxcui_for_brand(brand)
            time.sleep(REQUEST_SLEEP)
            if not rxcui:
                brands_not_found_in_rxnorm.append(brand)
                continue
            real_ingredients = set(get_real_ingredients(rxcui))
            time.sleep(REQUEST_SLEEP)
            if not real_ingredients:
                continue
            stored_ingredients = existing.get(brand, set())
            missing = real_ingredients - stored_ingredients
            total_checked += 1
            if missing:
                total_gaps_found += len(missing)
                log(f"  [{i}/{len(brands)}] {brand}: missing {sorted(missing)}")
                for generic in missing:
                    insert_missing_pair(conn, brand, generic)
                    total_inserted += 1
                conn.run("COMMIT")
            if i % 50 == 0:
                log(f"  ...progress: {i}/{len(brands)} brands checked, {total_gaps_found} gaps found so far")
        log(f"\n=== DONE ===")
        log(f"  Brands checked against RxNorm: {total_checked}")
        log(f"  Brands not found in RxNorm (skipped): {len(brands_not_found_in_rxnorm)}")
        log(f"  Total missing ingredient mappings found: {total_gaps_found}")
        log(f"  Total rows inserted: {total_inserted}")
        if brands_not_found_in_rxnorm:
            log(f"\n  Brands not found in RxNorm (first 20): {brands_not_found_in_rxnorm[:20]}")
    except Exception as e:
        conn.run("ROLLBACK")
        log(f"\nFATAL ERROR: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    run()