import requests

response = requests.get("https://api.cpicpgx.org/v1/gene")
response.raise_for_status()

genes = response.json()

print(f"Total genes: {len(genes)}\n")

for gene in genes:
    print(gene["symbol"])