"""Celery worker init (optional).
Configure a broker via env (e.g., Redis) and define tasks.
"""

import os
from celery import Celery


CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", CELERY_BROKER_URL)

celery_app = Celery(
    "wallet_scanner",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
)


@celery_app.task
def ping() -> str:
    return "pong"

