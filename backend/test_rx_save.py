import sys
import traceback
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.routes.prescriptions import save_prescription_tx, PrescriptionItemPayload, ensure_prescription_tables_exist
from app.database import engine
from sqlalchemy import text

def test():
    ensure_prescription_tables_exist()
    with engine.connect() as conn:
        p = conn.execute(text("SELECT patient_id FROM core.patient LIMIT 1")).fetchone()
        h = conn.execute(text("SELECT id FROM core.hcp_account LIMIT 1")).fetchone()
        print("Found patient:", p, "Found HCP:", h)

        if not p or not h:
            print("Missing test patient or HCP in database!")
            return

        patient_id = p[0]
        doctor_id = h[0]

        items = [
            PrescriptionItemPayload(drugName="Clopidogrel", dosage="75 mg", frequency="Once daily", durationDays=30),
            PrescriptionItemPayload(drugName="Atorvastatin", dosage="20 mg", frequency="Once daily", durationDays=30)
        ]

        try:
            rx_id = save_prescription_tx(patient_id=patient_id, doctor_id=doctor_id, items_raw=items)
            print("SUCCESS! Created rx_id:", rx_id)
        except Exception as e:
            print("ERROR IN SAVE_PRESCRIPTION_TX:")
            traceback.print_exc()

if __name__ == "__main__":
    test()
