import requests

response = requests.get("https://api.cpicpgx.org/v1/pair_view")
response.raise_for_status()

pairs = response.json()

print(f"Total gene-drug pairs: {len(pairs)}")