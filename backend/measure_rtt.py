from app.database import engine
from sqlalchemy import text
import time
import statistics

def check_rtt():
    print(f"PostgreSQL Remote Host: {engine.url.host}")
    times = []
    with engine.connect() as conn:
        for _ in range(20):
            t0 = time.perf_counter()
            conn.execute(text("SELECT 1")).scalar()
            times.append((time.perf_counter() - t0) * 1000)
    print(f"Network RTT over TLS (SELECT 1) for 20 pings:")
    print(f"  Min: {min(times):.2f} ms")
    print(f"  Median: {statistics.median(times):.2f} ms")
    print(f"  Mean: {statistics.mean(times):.2f} ms")
    p95 = sorted(times)[int(len(times) * 0.95)]
    print(f"  p95: {p95:.2f} ms")

if __name__ == "__main__":
    check_rtt()
