class BaseScanner:
    async def scan_address(self, address: str):
        raise NotImplementedError

    async def scan_xpub(self, xpub: str):
        raise NotImplementedError

