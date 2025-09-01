import asyncio
from .config import settings


# Provider-specific semaphores to throttle concurrency
sem_blockchair = asyncio.Semaphore(settings.BLOCKCHAIR_MAX_CONCURRENCY)
sem_infura = asyncio.Semaphore(settings.INFURA_MAX_CONCURRENCY)
sem_etherscan = asyncio.Semaphore(4)
sem_tatum = asyncio.Semaphore(10)
