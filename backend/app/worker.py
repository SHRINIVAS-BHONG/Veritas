import sys
import os

# Add workspace directory to python path for package resolution
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import redis  # type: ignore
from rq import Worker, Queue, Connection  # type: ignore
from backend.app.config import settings

def start_worker():
    listen = ['veritas_evals']
    
    # Establish connection
    print(f"Connecting to Redis at {settings.REDIS_URL}...")
    conn = redis.from_url(settings.REDIS_URL)
    
    with Connection(conn):
        worker = Worker(map(Queue, listen))
        print("Starting RQ worker listening on queue 'veritas_evals'...")
        worker.work()

if __name__ == '__main__':
    start_worker()
