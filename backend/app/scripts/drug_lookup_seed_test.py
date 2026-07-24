from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
	sys.path.insert(0, str(ROOT))

from app.routes.drug_lookup import lookup_drug_genes


SEED_DRUG_NAMES = [
	"atazanavir",
	"atomoxetine",
	"atorvastatin",
	"citalopram",
	"warfarin",
]


def main() -> None:
	results = lookup_drug_genes(SEED_DRUG_NAMES)
	print(json.dumps({"drug_names": SEED_DRUG_NAMES, "results": results}, indent=2, default=str))


if __name__ == "__main__":
	main()
