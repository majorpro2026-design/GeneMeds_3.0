import time
import statistics
import json
from app.database import engine
from sqlalchemy import text

def run_reproducible_benchmark():
    print("=== AUDIT BENCHMARK: CYP2D6 *4/*4 LOOKUP ===")
    
    orig_sql = text("""
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT
            pr.phenotype_name,
            pr.activity_score,
            pr.description
        FROM knowledge.diplotype d
        JOIN knowledge.gene g ON g.gene_id = d.gene_id
        JOIN knowledge.phenotype_reference pr ON pr.phenotype_id = d.phenotype_id
        WHERE lower(btrim(g.gene_symbol)) = lower(btrim('CYP2D6'))
          AND lower(btrim(d.diplotype_name)) = lower(btrim('*4/*4'))
        LIMIT 1
    """)

    opt_sql = text("""
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT
            pr.phenotype_name,
            pr.activity_score,
            pr.description
        FROM knowledge.diplotype d
        JOIN knowledge.gene g ON g.gene_id = d.gene_id
        JOIN knowledge.phenotype_reference pr ON pr.phenotype_id = d.phenotype_id
        WHERE g.gene_symbol = 'CYP2D6'
          AND d.diplotype_name = '*4/*4'
        LIMIT 1
    """)

    ping_sql = text("SELECT 1")

    N = 30
    server_orig_exec_times = []
    server_orig_plan_times = []
    client_orig_latencies = []
    rows_filtered_orig = []

    server_opt_exec_times = []
    server_opt_plan_times = []
    client_opt_latencies = []

    network_rtts = []

    with engine.connect() as conn:
        print(f"Warmup...")
        conn.execute(ping_sql).scalar()
        conn.execute(orig_sql).scalar()
        conn.execute(opt_sql).scalar()

        print(f"Measuring Network RTT (SELECT 1) for N={N}...")
        for _ in range(N):
            t0 = time.perf_counter()
            conn.execute(ping_sql).scalar()
            t1 = time.perf_counter()
            network_rtts.append((t1 - t0) * 1000)

        print(f"Measuring Original Query (lower(btrim(...))) for N={N}...")
        for _ in range(N):
            t0 = time.perf_counter()
            plan = conn.execute(orig_sql).scalar()
            t1 = time.perf_counter()
            client_orig_latencies.append((t1 - t0) * 1000)
            
            plan_obj = plan[0]
            server_orig_exec_times.append(plan_obj["Execution Time"])
            server_orig_plan_times.append(plan_obj["Planning Time"])

        print(f"Measuring Optimized Query (indexed) for N={N}...")
        for _ in range(N):
            t0 = time.perf_counter()
            plan = conn.execute(opt_sql).scalar()
            t1 = time.perf_counter()
            client_opt_latencies.append((t1 - t0) * 1000)
            
            plan_obj = plan[0]
            server_opt_exec_times.append(plan_obj["Execution Time"])
            server_opt_plan_times.append(plan_obj["Planning Time"])

    results = {
        "N": N,
        "network_rtt_ms": {
            "min": round(min(network_rtts), 2),
            "median": round(statistics.median(network_rtts), 2),
            "mean": round(statistics.mean(network_rtts), 2),
            "p95": round(sorted(network_rtts)[int(N * 0.95)], 2),
            "max": round(max(network_rtts), 2),
            "raw": [round(x, 2) for x in network_rtts]
        },
        "server_orig_exec_time_ms": {
            "min": round(min(server_orig_exec_times), 3),
            "median": round(statistics.median(server_orig_exec_times), 3),
            "mean": round(statistics.mean(server_orig_exec_times), 3),
            "p95": round(sorted(server_orig_exec_times)[int(N * 0.95)], 3),
            "max": round(max(server_orig_exec_times), 3),
            "raw": [round(x, 3) for x in server_orig_exec_times]
        },
        "server_orig_plan_time_ms": {
            "median": round(statistics.median(server_orig_plan_times), 3),
            "mean": round(statistics.mean(server_orig_plan_times), 3),
        },
        "server_opt_exec_time_ms": {
            "min": round(min(server_opt_exec_times), 3),
            "median": round(statistics.median(server_opt_exec_times), 3),
            "mean": round(statistics.mean(server_opt_exec_times), 3),
            "p95": round(sorted(server_opt_exec_times)[int(N * 0.95)], 3),
            "max": round(max(server_opt_exec_times), 3),
            "raw": [round(x, 3) for x in server_opt_exec_times]
        },
        "server_opt_plan_time_ms": {
            "median": round(statistics.median(server_opt_plan_times), 3),
            "mean": round(statistics.mean(server_opt_plan_times), 3),
        },
        "client_orig_latency_ms": {
            "min": round(min(client_orig_latencies), 2),
            "median": round(statistics.median(client_orig_latencies), 2),
            "mean": round(statistics.mean(client_orig_latencies), 2),
            "p95": round(sorted(client_orig_latencies)[int(N * 0.95)], 2),
            "max": round(max(client_orig_latencies), 2),
        },
        "client_opt_latency_ms": {
            "min": round(min(client_opt_latencies), 2),
            "median": round(statistics.median(client_opt_latencies), 2),
            "mean": round(statistics.mean(client_opt_latencies), 2),
            "p95": round(sorted(client_opt_latencies)[int(N * 0.95)], 2),
            "max": round(max(client_opt_latencies), 2),
        }
    }

    # Speedup calculations
    speedup_server_median = results["server_orig_exec_time_ms"]["median"] / results["server_opt_exec_time_ms"]["median"]
    speedup_server_mean = results["server_orig_exec_time_ms"]["mean"] / results["server_opt_exec_time_ms"]["mean"]
    results["speedup_server_median"] = round(speedup_server_median, 2)
    results["speedup_server_mean"] = round(speedup_server_mean, 2)

    with open("audit_benchmark_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print("\n=== BENCHMARK COMPLETE ===")
    print(f"Network RTT: median={results['network_rtt_ms']['median']} ms, p95={results['network_rtt_ms']['p95']} ms")
    print(f"Original Query Server Exec: median={results['server_orig_exec_time_ms']['median']} ms, p95={results['server_orig_exec_time_ms']['p95']} ms")
    print(f"Optimized Query Server Exec: median={results['server_opt_exec_time_ms']['median']} ms, p95={results['server_opt_exec_time_ms']['p95']} ms")
    print(f"Verified Server-Side Speedup Factor (Median): {results['speedup_server_median']}x")

if __name__ == "__main__":
    run_reproducible_benchmark()
