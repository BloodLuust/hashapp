[![Ethical Use: Watch‑Only](https://img.shields.io/badge/Ethical%20Use-Watch--Only%20By%20Default-brightgreen)](#purpose-ethics--safe-use)
[![Sweeping: Disabled](https://img.shields.io/badge/Sweeping-Disabled%20by%20default-lightgrey)](#purpose-ethics--safe-use)
[![Responsible Disclosure](https://img.shields.io/badge/Security-Responsible%20Disclosure-blue)](SECURITY.md)
[![Code of Conduct](https://img.shields.io/badge/Community-Code%20of%20Conduct-9cf)](CODE_OF_CONDUCT.md)

# <a name="header"></a><a name="content"></a><a name="x4d1c873bd45608d482b7494dc1d01a31a1cd69d"></a>Multi-Chain Wallet Scanner & Explorer – Architecture & Development Plan
## <a name="project-overview"></a>Project Overview
Build a **full-stack** web application for scanning cryptocurrency wallets (addresses and extended public keys) across multiple blockchains. The system will consist of a **Next.js** frontend and a **FastAPI** backend, with a **MongoDB** database for persistence. Users can create accounts, initiate scans of their wallet addresses (e.g. Bitcoin xpub/ypub/zpub/tpub or Ethereum addresses), and view real-time progress and historical analytics of transactions. The application will leverage external blockchain APIs (Infura, Tatum, Blockchair) to fetch comprehensive transaction history for each supported chain[\[1\]](https://blockchair.com/api/docs#:~:text=Blockchair%20API%20provides%20developers%20with,sorting%2C%20and%20aggregating%20blockchain%20data)[\[2\]](https://vocal.media/education/the-top-10-blockchain-api-providers-for-developers-in-2025#:~:text=7). We will containerize all components with Docker for easy deployment and ensure the system is secure, scalable, and maintainable.
## <a name="system-architecture"></a>System Architecture
**Components & Data Flow:** The architecture follows a modular, service-oriented design:

- **Next.js Frontend:** A React-based SSR/SPA that provides a sleek UI for user interaction (login, initiating scans, viewing results). It communicates with the backend via REST API calls (and WebSockets for live updates)[\[3\]](https://medium.com/@pottavijay/creating-a-scalable-full-stack-web-app-with-next-js-and-fastapi-eb4db44f4f4e#:~:text=,managing%20rate%20limits%20in%20FastAPI). Charts and dashboards are rendered on the client side to display historical transaction data and real-time scan status.
- **FastAPI Backend:** A Python asynchronous API server that exposes endpoints for authentication, initiating scans, retrieving scan results, and downloading reports. It handles heavy-lifting tasks like deriving addresses from xpubs, querying external blockchain APIs, and aggregating results. Long-running scan tasks are executed asynchronously (using asyncio or background workers) to keep requests responsive.
- **External Blockchain APIs:** The backend integrates with **Infura**, **Tatum**, and **Blockchair** for blockchain data. **Infura** provides reliable Ethereum (and other EVM chain) access[\[4\]](https://vocal.media/education/the-top-10-blockchain-api-providers-for-developers-in-2025#:~:text=9); **Tatum** offers a unified API covering 40+ blockchains[\[5\]](https://vocal.media/education/the-top-10-blockchain-api-providers-for-developers-in-2025#:~:text=Overview%3A%20Tatum%20provides%20an%20all,use%20APIs%20for%20multiple%20blockchains); **Blockchair** supports multiple chains (BTC, ETH, etc.) and even directly handles extended public keys (xpub) for Bitcoin-like networks[\[6\]](https://blockchair.com/api/docs#:~:text=,Transaction). These services return transaction histories, balances, and other relevant data for addresses and xpubs.
- **MongoDB Database:** A NoSQL database to store user accounts, scan requests, and results logs. Using MongoDB with the async Motor driver allows non-blocking DB operations from FastAPI[\[7\]](https://www.mongodb.com/developer/products/mongodb/8-fastapi-mongodb-best-practices/#:~:text=FastAPI%20seamlessly%20integrates%20with%20MongoDB,ideal%20for%20creating%20applications%20that). The database logs each scan’s input, status, summary results, and timestamps, as well as user activity (e.g. logins) and system metrics.
- **Optional Caching/Queue (Redis):** For performance enhancements, a Redis instance may be introduced. It can serve as a cache for frequently requested data (to avoid repetitive API calls) and as a message broker or task queue for offloading scan tasks to worker processes, improving throughput under load.

**Interactions:** In a typical flow, a user initiates a scan via the frontend. The request goes to the FastAPI backend (through a secure HTTPS connection). The backend creates a scan job (logging it in MongoDB) and either processes it asynchronously in-place or enqueues it to a worker. The user sees immediate feedback (e.g. “scan started”) and can then receive live progress updates via WebSocket or polling. The backend calls external APIs for each address or key and compiles the results. Once complete, results are stored in MongoDB and the user can view a summary on the dashboard or download a detailed report.
## <a name="frontend-next.js"></a>Frontend (Next.js)
**Framework & Setup:** Use **Next.js 13** (React 18+) for the frontend. Initialize the project with TypeScript for type safety (npx create-next-app@latest --typescript). Next.js provides SSR for better SEO and faster initial loads, which suits our dashboard pages, and can also serve as a SPA for interactive charts. The app will have a modern, responsive UI (consider using a UI framework like **Tailwind CSS + Shadcn/UI** or **Material-UI** for a sleek design). We’ll maintain a consistent look (dark mode friendly charts, etc.) and intuitive UX.

**Authentication UI:** Create pages for **Register/Login** where``` users ```can sign up and sign in. Use form components to capture credentials and call backend API endpoints for auth. Upon successful login, store the JWT in an **HTTP-only cookie** (for security) or in memory via Next.js server-side session if using a sessions approach. Next.js can also use next-auth or a custom solution to manage auth state; in this plan we’ll implement custom JWT auth for learning purposes. After login, protect internal routes (like the dashboard) by checking auth status (e.g. using Next.js middleware or guard logic in ```getServerSideProps```).

**Dashboard & Scan Interface:** Authenticated``` users ```land on a **Dashboard** page. This page will allow inputting a cryptocurrency identifier to scan. Provide forms to enter: 
- A single **address** (e.g. Ethereum address or Bitcoin address), **or** - An **extended public key** (xpub/ypub/zpub for BTC or tpub for testnet) for multi-address scanning.

Users can select which chain the input corresponds to (or autodetect based on format/prefix). On submission, the frontend calls the backend scan API (e.g. ```POST /api/scan```) with the provided key/address and chosen chain.

**Real-time Status:** Once a scan is initiated, the UI should show a real-time progress indicator. Utilize Next.js’s ability to handle WebSockets or Server-Sent Events: the frontend can open a WebSocket connection to the FastAPI backend (FastAPI supports WebSockets natively) to receive progress updates (e.g. “20% complete – 10 addresses scanned”). Alternatively, implement periodic polling (e.g. every few seconds call a status endpoint). The real-time status is displayed via a progress bar or live logs on the page.

**Historical Charts:** After or during a scan, present visualizations of the data. For example: 
- A **time-series chart** showing the balance of the wallet over time or number of transactions over months. 
- Charts for **transaction volume** (inbound vs outbound) or distribution of token types (if scanning token balances on Ethereum). Use a chart library like **Chart.js** or **Recharts** to render these. The data for charts will be fetched from the backend’s results endpoints (e.g. GET /api/scan/{id}/results) which returns aggregated data (like balance over time series). Next.js can pre-fetch some data server-side (using ```getServerSideProps```) for initial render of historical charts[\[8\]](https://medium.com/@pottavijay/creating-a-scalable-full-stack-web-app-with-next-js-and-fastapi-eb4db44f4f4e#:~:text=,managing%20rate%20limits%20in%20FastAPI), then use client-side fetch or the WebSocket for live updates.

**Logs & Reports:** Provide a section in the UI for viewing **logs of past scans**. This could be a table listing previous scans (date, type, target, status, summary of findings). This data comes from the backend (e.g. GET /api/scan?user=current). Each entry can have a “View” button to see details or a “Download Report” button. For report downloads, the frontend will simply hit an endpoint like /api/scan/{id}/report which triggers a file download (likely a CSV or PDF). Ensure the download link is only accessible to the user who initiated the scan (the backend will verify JWT and ownership).

**Frontend Structure:** Organize Next.js project files logically:
```bash
frontend/
├── pages/
│   ├── index.tsx            # Landing or home page (could redirect to dashboard if logged in)
│   ├── login.tsx            # Login page
│   ├── register.tsx         # Registration page
│   ├── dashboard.tsx        # Main dashboard (protected)
│   ├── scans/[id].tsx       # Page to view details of a specific scan (or use modal on dashboard)
│   └── api/                 # (Optional) Next.js API routes if needed for custom serverless functions
├── components/
│   ├── Layout.tsx           # Layout component (navigation, footer)
│   ├── ScanForm.tsx         # Form to input address or xpub and start scan
│   ├── ProgressIndicator.tsx # Displays real-time progress
│   ├── Charts/              # Folder for chart components (balance chart, tx history chart)
│   └── ...other UI components...
├── hooks/                   # Custom React hooks (e.g., useAuth, useWebSocket)
├── lib/                     # Utility modules (e.g., API client functions for Axios/fetch)
├── public/                  # Static assets
├── styles/                  # Global styles or Tailwind config
├── Dockerfile               # Dockerfile for frontend container
├── package.json
└── tsconfig.json
```
**State Management:** Use React Context or Zustand for global state (like auth user info, or using Next.js built-in support for session via cookies). For simplicity, JWT will be stored in an HttpOnly cookie, and we’ll fetch user-specific data on each request via SSR (reading the cookie) or by making an API call with the token. This avoids heavy client state management and leverages Next.js’s server-side capabilities.
## <a name="backend-fastapi-python"></a>Backend (FastAPI & Python)
**Framework & Design:** Implement the backend with **FastAPI** for high-performance async IO and automatic docs (OpenAPI). FastAPI natively supports asyncio, allowing us to call external APIs concurrently to speed up scans. We will structure the backend following FastAPI best practices, using **APIRouters** to organize endpoints by feature[\[9\]](https://fastapi.tiangolo.com/tutorial/bigger-applications/#:~:text=Bigger%20Applications%20,them%20to%20the%20main%20app). For instance, create separate route modules for authentication (auth.py), scanning (scan.py), and perhaps user profile management (users.py).

**Core Functionalities:**

- **User Authentication:** Use JWT auth with secure password hashing. We’ll store users’ passwords hashed (e.g. using **bcrypt** via the fastapi-users library which provides a complete auth system with hashed passwords and JWT support out of the box[\[10\]](https://github.com/vintasoftware/nextjs-fastapi-template#:~:text=,environments%20for%20development%20and%20production)). Alternatively, we manually implement: store a password\_hash (from bcrypt or Argon2) in MongoDB, then verify on login and issue a signed JWT (using PyJWT or FastAPI’s OAuth2PasswordBearer mechanism). FastAPI will have dependency logic to protect routes (e.g. get\_current\_user dependency that checks the JWT). The JWT secret key is kept in an environment variable and rotated or invalidated on logout as needed (or we use short-lived tokens with refresh logic).
- **Scan Scheduling:** When a **scan request** comes in (```POST /api/scan``` with JSON containing an address or xpub and chain), the backend will create a new **Scan Job** entry in MongoDB (status = "pending"). The scanning itself can be handled in two ways:
- **Inline async task:** Launch a background task using BackgroundTasks or by spawning an asyncio.create\_task within the request (so the request returns immediately with a job ID). The task then runs in the background on the server process.
- **Task Queue:** For production robustness, use a distributed task queue like **Celery** or **RQ** with a **Redis** broker. In this approach, the API enqueues the job and returns a job ID; a separate worker process (container) consumes the queue and performs the scan. This allows scaling workers horizontally for heavy usage. (Given our Docker setup, we can easily add a worker service container running Celery if needed).

Initially, we can start with the simpler inline background task approach for development, then plan to introduce Celery for scalability (as noted in **Scaling & Patterns** below).

- **Address Derivation (HD Wallets):** If the input is an **extended public key (xpub/ypub/zpub)**, the backend must derive child addresses to scan. We will implement BIP32/BIP44 address derivation logic:
- Use an existing library like bip\_utils or bitcoinlib, or leverage a custom utility (the repository already contains a``` bip32.py ```module that supports deriving non-hardened child public keys and computing P2PKH/P2WPKH addresses[\[11\]](https://github.com/BloodLuust/masterpig/blob/4717bb49c20c574c973966b1e1fdb64e31ef4a20/app/bip32.py#L6-L14)[\[12\]](https://github.com/BloodLuust/masterpig/blob/4717bb49c20c574c973966b1e1fdb64e31ef4a20/app/bip32.py#L260-L269)). We can integrate that code to derive addresses from the xpub.
- We will follow the standard gap limit approach: derive addresses in sequence (e.g. m/0/0, m/0/1, ...) and query each for transactions. Continue until a certain number of consecutive unused addresses (e.g. 20) is found, then stop, to ensure we capture all active addresses under the xpub without scanning forever.
- This derivation will produce a list of addresses (potentially hundreds if the xpub has many used addresses). We will **batch** these and query in parallel to speed up scanning. For example, derive 20 addresses, then use asyncio.gather to call the external API for those 20 addresses concurrently, then continue with the next batch. This leverages FastAPI’s async nature to maximize throughput.
- **External API Integration:** Abstract the blockchain access behind a clean interface. For each chain or provider:
- Write a **service module** or class for interactions. e.g. blockchair\_api.py to call Blockchair endpoints, tatum\_api.py for Tatum calls, etc. These will contain async functions to get transactions by address or xpub. Use **aiohttp** or **httpx** (async HTTP clients) for these calls, enabling parallel requests.
- Use API keys stored in env (INFURA\_API\_KEY, TATUM\_API\_KEY, etc.). For Infura (Ethereum), we’ll likely use their HTTP or WebSocket JSON-RPC endpoints to fetch transactions and balances. For Blockchair, we can call their REST endpoints (Blockchair has an endpoint for xpub that returns multiple addresses and their balances/transactions, which could simplify Bitcoin scanning by getting all in one call[\[6\]](https://blockchair.com/api/docs#:~:text=,Transaction)). For Tatum, we can use their unified endpoints (e.g. a single call to get all transactions for a given address on a specific chain).
- **Retries & Error Handling:** Wrap API calls with retry logic (e.g. use the tenacity library or custom exponential backoff) for resilience against transient failures or rate limits. If a call returns a rate-limit response or timeouts, wait and retry a few times before marking that part of the scan as failed.
- Implement a **circuit breaker** pattern for external APIs to avoid repeatedly hitting an API that is down[\[13\]](https://fmelihh.medium.com/system-design-1-implementing-the-circuit-breaker-pattern-in-fastapi-e96e8864f342#:~:text=Implementing%20a%20Circuit%20Breaker%20provides,several%20key%20benefits). For example, if Blockchair is failing continuously, open a circuit and temporarily route those requests to an alternative (maybe Tatum as fallback) or abort early to keep the system responsive. This prevents cascading failures when an external service is unresponsive[\[14\]](https://fmelihh.medium.com/system-design-1-implementing-the-circuit-breaker-pattern-in-fastapi-e96e8864f342#:~:text=%E2%9C%85%20Prevents%20cascading%20failures%20%E2%80%94,services%20that%20are%20already%20struggling).
- **Data Aggregation:** As results come in from external APIs:
- Parse and normalize the data. Different APIs have different response schemas, so convert them into a unified internal format (e.g. a Python dict with fields like txid, date, amount, from, to, fee etc. for transactions). This makes it easier to aggregate and store.
- Calculate summary stats: total balance of the wallet, total received/sent, number of transactions, etc. If dealing with multiple addresses (xpub scan), aggregate across all derived addresses.
- Store **detailed results** if needed: depending on volume, we might store each transaction in a **results collection** or embed a limited number in the scan document. Given potentially large histories, an alternative is not to store all transaction details in DB (just store summary and perhaps the list of addresses found), and rely on on-demand calls or generating a report file for detailed info. We will at least store enough to show a summary and to quickly serve the charts (which might require time-series of balances or counts).
- Mark the scan job as **completed** (or failed) in MongoDB with timestamps and any error info. Also log how long it took and how many API calls were made (for monitoring).
- **Logging & Monitoring:** Every important action will be logged:
- Use Python’s logging (or loguru) to record events like “User X initiated Bitcoin xpub scan”, “Calling Blockchair API for address Y”, errors, etc. In production, these logs can be sent to a file or logging service. In addition, maintain an **audit trail** in Mongo (e.g. a scans collection entry serves as a log of that scan, and possibly a separate audit\_logs collection for user login/logout events).
- Consider capturing system metrics (CPU, memory usage) if needed in a metrics collection or use external monitoring tools (Prometheus/Grafana) – this is more of an operational concern and can be part of **deployment** steps.

**Backend Project Structure:** Organize code for clarity and scalability:

```bash
backend/
├── app/
│   ├── main.py            # FastAPI application initialization (includes routers, middleware)
│   ├── core/              
│   │   ├── config.py      # Configuration (reads env vars, API keys, DB URI, etc.)
│   │   ├── security.py    # Security utils (password hashing, JWT generation/verification)
│   │   └── utils.py       # Generic utilities (e.g., retry decorators, etc.)
│   ├── models/
│   │   ├── user.py        # Pydantic models for user (and maybe an ODM model if using an ORM)
│   │   ├── scan.py        # Pydantic models for scan request/response and MongoDB schema definitions
│   │   └── ...            # Possibly use Pydantic/BaseModel for data schemas
│   ├── api/
│   │   ├── routes_auth.py # Auth endpoints (register, login, logout)
│   │   ├── routes_scan.py # Scan endpoints (start scan, get status, get results, download report)
│   │   └── routes_users.py# (Optional) User profile endpoints
│   ├── services/
│   │   ├── blockchain/
│   │   │   ├── bitcoin.py    # Functions to scan BTC addresses/xpub via Blockchair/Tatum
│   │   │   ├── ethereum.py   # Functions to scan ETH via Infura/Tatum
│   │   │   ├── ...other_chains.py
│   │   │   └── __init__.py   # Possibly, an abstract base class for chain scanners
│   │   ├── address_derivation.py # HD wallet (BIP32) logic for xpub (could integrate code from bip32.py)
│   │   └── report_generator.py   # Utility to generate CSV/PDF from scan results
│   ├── workers/
│   │   └── worker.py      # (If using Celery) Celery worker initialization and tasks
│   ├── db/
│   │   ├── client.py      # MongoDB client setup (using Motor)
│   │   └── schemas.js     # (Optional) MongoDB collection schemas if using Mongoose-like ODM or just descriptive
│   └── __init__.py
├── tests/                 # Test cases for each component
├── Dockerfile             # Dockerfile for backend
├── requirements.txt
└── .env.example           # Example env variables (for development)
```

We’ll utilize **Motor (AsyncIO MongoDB driver)** for DB access, since FastAPI’s async nature requires an async-compatible DB client[\[15\]](https://www.mongodb.com/developer/products/mongodb/8-fastapi-mongodb-best-practices/#:~:text=Motor%C2%A0%E2%80%94%20but%20only%20one%20of,Fortunately%2C%20just%20like). For example, in db/client.py:

```python
from motor.motor_asyncio import AsyncIOMotorClient
mongo_client = AsyncIOMotorClient(settings.MONGO_URI)
db = mongo_client[settings.MONGO_DB_NAME]

```

We might wrap DB calls in repository classes or just call db.collection\_name.find\_one() directly in endpoints as needed (using await). For better structure, one could use an ODM (Object Document Mapper) like Beanie or MongoEngine, but given the simplicity of the data, raw Motor or Pydantic models suffices.

**Asynchronous Best Practices:** Throughout the backend, follow asyncio best practices: 
- Avoid blocking calls – use async HTTP clients and await them. 
- Limit concurrency if needed: too many parallel requests can exhaust network or rate limits. We might use semaphores or batches to throttle (e.g., only 10 concurrent API calls at a time). 
- Implement **retry with backoff** for network calls (e.g., if Infura is slow to respond, wait 1s, then 2s, etc., up to a max). This ensures robustness under unreliable network conditions[\[16\]](https://medium.com/@adityakolpe/python-asynchronous-programming-with-asyncio-and-aiohttp-186378526b01#:~:text=Here%2C%20each%20retry%20attempt%20waits,the%20server%20with%20frequent%20retries).
- Use **connection pooling**: reuse HTTP client sessions (e.g., create an aiohttp.ClientSession at startup and reuse it for all calls) to avoid overhead of reconnecting[\[17\]](https://www.pythoncentral.io/aiohttp-guide-to-asynchronous-http-in-python/#:~:text=AIOHTTP%3A%20Guide%20to%20Asynchronous%20HTTP,to%20benefit%20from%20connection). 
- Profile and test the async performance with a few sample large scans to tune the batch sizes and concurrency.
## <a name="supported-blockchains-extensibility">Supported Blockchains & Extensibility</a>
Initially, the system will support: 
- **Bitcoin (BTC)** – including mainnet and testnet (xpub/ypub/zpub for mainnet, tpub for testnet). We’ll use Blockchair and/or Tatum for BTC data. Blockchair’s API directly supports xpub scanning, returning addresses and transaction counts[\[6\]](https://blockchair.com/api/docs#:~:text=,Transaction), which we can use to identify active addresses quickly. 
- **Ethereum (ETH)** – using Infura for historical transactions and current balances. Ethereum doesn’t use xpubs in the same way, so scans will typically be single address (or multiple addresses if user enters several). We can also support any EVM-compatible chain that Infura or Tatum supports (e.g. Polygon, BSC) with minimal changes (just different RPC endpoints or chain IDs). 
- **Other Chains via Tatum/Blockchair:** Because Tatum supports 40+ chains and Blockchair ~14 chains, we can easily plug in support for those by configuring the API endpoints. For example, to add **Litecoin or Dogecoin**, we use Blockchair’s endpoints (just change the base URL and parameters for those networks). To add **Polygon** or **Solana**, use Tatum’s API with the corresponding chain code or their specific Python SDK if available[\[5\]](https://vocal.media/education/the-top-10-blockchain-api-providers-for-developers-in-2025#:~:text=Overview%3A%20Tatum%20provides%20an%20all,use%20APIs%20for%20multiple%20blockchains).

**Modular Design for Chains:** The backend services will be designed such that adding a new chain is straightforward: 
- In services/blockchain/, each file handles one blockchain or family. E.g., bitcoin.py can handle BTC, BCH, LTC (all UTXO-based, similar logic), whereas ethereum.py can handle ETH and tokens (account-based). 
- Each module should expose a function like get\_transactions(address) or scan\_address(address\_or\_xpub) that returns normalized data. New chains can be added by creating a new module or extending existing ones (if similar to an existing chain). 
- Maintain a mapping in a config or factory: e.g., CHAIN\_HANDLERS = {"bitcoin": BitcoinScanner(), "ethereum": EthScanner(), "litecoin": BitcoinScanner(network="LTC"), ...}. The scan endpoint can use this to dispatch to the appropriate handler based on the chain requested. This way, to add a chain, we register a new handler in this mapping and implement its logic.

By keeping the chain-specific logic decoupled, future integration of other chains (supported by Infura, Tatum, or Blockchair) is mostly a matter of writing a new service module and updating config – the rest of the system (frontend, auth, job handling) remains unchanged.

## <a name="database-schema-mongodb"></a>Database Schema (MongoDB)
Design MongoDB collections to store``` users ```and scan information:

- **Users Collection (users):** Stores user accounts.
- Fields: \_id (ObjectId), email (unique), password\_hash (bcrypt), created\_at, and perhaps last\_login. If using JWT, we might also store a refresh\_token or nothing extra (since JWTs are stateless). We will index the email for quick lookups. Password hashes are created with a strong algorithm and never stored in plaintext[\[10\]](https://github.com/vintasoftware/nextjs-fastapi-template#:~:text=,environments%20for%20development%20and%20production).
- **Scans Collection (scans):** Each document represents a scan job (past or present).
- Fields: \_id (ObjectId), user\_id (ObjectId ref to Users), input\_type ("address" or "xpub"), input\_value (the actual address or extended key string – for privacy, it’s okay to store since extended public keys and addresses are not secret keys), chain (e.g. "bitcoin", "ethereum"), status ("pending", "in\_progress", "completed", "failed"), requested\_at, completed\_at, and duration (computed).
- Also include a summary sub-document: e.g. { "total\_txs": 120, "total\_received": 1.5 BTC, "total\_sent": 0.8 BTC, "current\_balance": 0.7 BTC } or similar stats depending on chain. For ETH, perhaps token balances or total Ether moved.
- Possibly store addresses\_scanned: if an xpub was scanned, store the list of derived addresses (and maybe how many transactions each had).
- If storing detailed transactions, we have options:
  - **Inline**: include an array of transactions in the scan doc (only advisable if not too large or maybe limit to recent N transactions to cap size).
  - **Separate Collection (transactions)**: Each transaction as a document with a reference to scan\_id or address. This is more flexible and avoids one huge document. However, it could be a lot of data (e.g. scanning a busy ETH address could yield thousands of tx). We might skip storing all transactions in DB due to volume; instead, generate on-demand reports.
- In any case, ensure indices on fields we query often (e.g. user\_id + maybe status if we query active scans).
- **Audit/Logs Collection (logs or part of scans):** We can log events like login, API errors, etc. For simplicity, we might not need a separate collection; scans themselves serve as a log of scanning activity. But for system-wide metrics, one could have a system\_logs collection storing events (timestamp, message, level). This is optional and primarily for admins.

**Example Document (Scan):**
```json
{
  "_id": ObjectId("..."),
  "user_id": ObjectId("..."),
  "input_type": "xpub",
  "input_value": "xpub6CUGRUonZ...5Tf3KmBH", 
  "chain": "bitcoin",
  "status": "completed",
  "requested_at": ISODate("2025-08-30T10:00:00Z"),
  "completed_at": ISODate("2025-08-30T10:02:30Z"),
  "duration_sec": 150,
  "summary": {
    "total_addresses": 35,
    "total_txs": 120,
    "total_received": 1.2345,
    "total_sent": 0.5345,
    "current_balance": 0.7000,
    "currency": "BTC"
  },
  "addresses_scanned": [
    "1A1zP1e......", "...", "...", 
    "... (35 addresses total) ..."
  ],
  "error": null
}

```


If a scan fails, ```status``` would be "failed" and an ```error``` field could capture the reason.

The **MongoDB connection string and credentials** will be stored in environment variables and loaded in ```config.py```. We’ll use a single database (e.g. named ```wallet\_scanner\_db```) with the above collections.
## <a name="security-best-practices"></a>Security Best Practices
Security is paramount since we deal with sensitive user data (emails, passwords) and potentially API keys:

- **Authentication & Password Storage:** Use strong hashing (e.g. Bcrypt with salt) for passwords[\[github\]](https://github.com/vintasoftware/nextjs-fastapi-template#:~:text=,environments%20for%20development%20and%20production). No plaintext passwords ever stored. Implement account lockout or rate-limit on login attempts to prevent brute force. JWT tokens are signed with a strong secret; use short expiration (e.g. 15 minutes) and refresh tokens if needed. Transmit JWT in HttpOnly cookies to mitigate XSS (the Next.js frontend can use ```fetch``` with credentials, or store token in memory and send in '''Authorization''' header if easier, but then protect against XSS stealing it).
- **Input Validation:** Both frontend and backend validate inputs. Use Pydantic models in FastAPI to ensure addresses or xpubs conform to expected patterns. Reject obviously malformed inputs early. This prevents injection attacks – e.g., an xpub is a base58 string ~111 chars, we can enforce length and allowed chars, so a SQL injection string wouldn’t even parse as valid.
- **Authorization:** Every backend endpoint (besides login/register) will require a valid JWT. FastAPI’s dependency system will throw 401 if not provided or invalid. Additionally, ensure``` users ```can only access their own data: e.g. if requesting ```/api/scan/{id}```, check the scan’s user\_id matches the authenticated user’s ID, else return 403.
- **Avoid Sensitive Data in Client:** All secret keys (API keys for Infura, etc.) stay on the server in environment variables. Next.js will not expose these. When Next.js needs to call an external API (unlikely, since our design routes all such calls through the backend), it would go through the backend. This ensures Infura/Tatum keys are not leaked. Next.js environment variables for public use will have ```NEXT\_PUBLIC\_``` prefix (for non-secret config).
- **Environment Management:** Use ```.env``` files for dev and production configs (not checked into source). Docker Compose will load these. For production, consider using Docker secrets or environment variables directly on the server. This keeps API keys and the JWT secret out of the codebase.
- **Web Vulnerabilities:**
    - Mitigate **XSS** by using React/Next’s default escaping for any dynamic content, and by not storing JWTs in localStorage (to avoid JS access). Also, set secure cookie flags.
    - Prevent **CSRF**: If using cookies for auth, our API should implement CSRF tokens or ```same-site``` cookies. Since the frontend and backend likely serve on the same domain (or subdomain), setting ```SameSite=Lax``` or ```Strict``` on cookies can help. Alternatively, since this is an API (not browser-rendered forms), requiring the JWT header might suffice as CSRF protection.
    - Guard against **SSRF**: Our backend makes requests to external APIs. We must ensure that the URLs we call are from trusted sources (Infura, Tatum, etc.). Do not fetch user-provided URLs. If any functionality ever required fetching a user-given URL, we’d validate it (not needed in this scanner scenario).
    - **SQL/NoSQL Injection**: Use parameterized queries or driver methods for DB. With Motor, queries are built as Python dicts, so not prone to injection like string concatenation would be. Still, avoid dynamically constructing field names or operators from user input without checks.
    - **File Handling**: If we allow file downloads (reports), generate them on the fly or store with randomized filenames. Ensure directory traversal is impossible (don’t directly use any user input in file paths on disk).
- **Rate Limiting:** To prevent abuse of our service (which could also protect our API usage quotas), implement rate limiting on the backend. For example, limit each user to e.g. 5 scan requests per minute. We can use a middleware that tracks requests per user IP or account (store counters in Redis or an in-memory cache)[\[medium\]](https://medium.com/@pottavijay/creating-a-scalable-full-stack-web-app-with-next-js-and-fastapi-eb4db44f4f4e#:~:text=,managing%20rate%20limits%20in%20FastAPI). FastAPI doesn’t have built-in rate limit, but libraries like ```fastapi-limiter``` (using Redis) can be integrated. Nginx can also be configured to rate limit at the proxy level. This helps avoid denial-of-service and excessive load (especially since scans trigger many external API calls).
- **Secure Transmission:** All network communication will be over **HTTPS**. We’ll obtain an SSL certificate (via Let’s Encrypt) for our domain and configure Nginx to terminate TLS. This encrypts user credentials and results in transit. Additionally, enforce HSTS in responses to prevent downgrade attacks.
- **Secrets Management:** Keep secrets out of code. The ```.env``` will contain things like ```MONGO\_URI```, ```JWT\_SECRET```, ```INFURA\_KEY```, ```TATUM\_KEY```, etc., and these will be injected into the containers at runtime. Docker images should not bake in any secret values. Also, use distinct secrets for dev/staging vs production (and regenerate JWT secret if any breach).
- **Dependency Security:** Use the latest versions of dependencies and monitor for vulnerabilities (e.g., via ```npm audit``` and ```pip safety```). Lock dependency versions in requirements.txt/package-lock to known good versions. For instance, use ```fastapi``` (which brings Starlette, Pydantic) and ensure they are updated periodically.
- **Testing & Monitoring:** Before deployment, pen-test the app (at least run automated vulnerability scanners or use tools like OWASP ZAP). Set up monitoring for unusual activities (e.g., too many failed logins could indicate a brute force attempt – we can log and potentially ban IPs or require CAPTCHA after X failures).
## Performance & Scalability

From the outset, design the system to handle a reasonable load and be scalable
- **Async Concurrency:** The use of FastAPI with async and external IO-bound calls means we can handle many concurrent requests without blocking threads. Uvicorn (the ASGI server) can be run with multiple worker processes (e.g. using Gunicorn with Uvicorn workers) to leverage multi-core CPUs[\[medium\]](https://medium.com/@pottavijay/creating-a-scalable-full-stack-web-app-with-next-js-and-fastapi-eb4db44f4f4e#:~:text=,throughput%20apps). For example, in production run ```gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app.``` Each worker can handle many in-flight async tasks.
- **Task Queuing:** As mentioned, heavy scanning work can be offloaded to Celery workers. This allows the web API to quickly enqueue and respond, improving responsiveness. Celery with a Redis or RabbitMQ broker can manage dozens of scan tasks in parallel across multiple worker instances. We’d design tasks to be idempotent and retryable (so if a worker crashes or a task fails, it can retry or be picked up by another). This distributed work model aligns with large-scale architectures[\[medium\]](https://medium.com/@pottavijay/creating-a-scalable-full-stack-web-app-with-next-js-and-fastapi-eb4db44f4f4e#:~:text=,throughput%20apps).
- **Batching & API Efficiency:** When possible, batch requests to external APIs:
- Use Blockchair’s bulk endpoints (e.g., they have an address batch endpoint) to fetch multiple addresses in one call[\[blockchain\]](https://blockchair.com/api/docs#:~:text=,Transaction).
- Use Tatum’s endpoints which might return multiple data points in one request. This reduces the overhead per address.
- If no batch endpoint, we batch at our level by grouping asyncio calls and awaiting them together. This still benefits from concurrency but avoids hitting thousands of requests concurrently.
- **Caching:** Implement caching for frequently repeated queries. For instance, if the same address or xpub is scanned multiple times in a short period, cache the result for a certain time (e.g. 5 minutes) to serve instantly next time. We can use an in-memory cache or Redis. For example, maintain a Redis cache with key like ```scan:{chain}:{address}``` storing the last result JSON and a timestamp. The next request can check this and if it's recent, use it instead of hitting external APIs again. This is especially useful if multiple``` users ```might scan popular addresses or if a user repeats a scan.
- **WebSocket Efficiency:** For real-time updates, use a single WebSocket connection per scan that streams progress. This is more efficient than polling every second. The backend can send a message after each batch of addresses processed. The frontend updates the progress bar and logs. FastAPI can handle WebSockets, but under heavy load one might consider using a dedicated pub/sub or WebSocket service (not needed unless scaling to many concurrent scans).
- **Resource Management:** Each scan can be memory intensive if storing lots of data in memory. We will stream data where possible. For example, if generating a CSV report of transactions, stream directly from the API or DB cursor to the file response (using ```StreamingResponse```) rather than building a huge list in memory. Similarly, when forwarding data from external API to client (if ever needed), use streaming.
- **Auto-Scaling & Load Balancing:** In a production environment, container orchestration (Kubernetes or Docker Swarm) can scale the backend and frontend separately. The stateless nature of the app (aside from DB) allows multiple instances. A load balancer (or Nginx) can distribute requests. If WebSocket is used, ensure the load balancer supports sticky sessions or use a pub/sub for WS messages in a multi-instance scenario.
- **Circuit Breakers & Fault Tolerance:** As noted, integrate circuit breaker logic so that if an external API is failing (e.g. Tatum is down), our system will fail fast for those requests (perhaps return an error to user like “External service unavailable, try later”) rather than hanging. This keeps the thread/worker free to handle other requests and avoids backlog[\[fmelihh.medium.com\]](https://fmelihh.medium.com/system-design-1-implementing-the-circuit-breaker-pattern-in-fastapi-e96e8864f342#:~:text=%E2%9C%85%20Prevents%20cascading%20failures%20%E2%80%94,services%20that%20are%20already%20struggling). Libraries like ```aiobreaker``` can be used to wrap calls to each external service.
- **Throughput Monitoring:** Use logging or metrics to monitor how long scans take and where the bottlenecks are. We can record per-address API call latency. If Infura is slow, maybe use a different provider or adjust strategy. If certain addresses have huge history, perhaps impose limits (like only last N transactions or warn user).
- **Redis for Rate Limits and Queues:** As mentioned, a single Redis can serve both as a **rate-limit counter store** (fast INCR operations per IP or user) and as a **Celery broker** and **result backend**. This avoids introducing too many different technologies and keeps latency low (Redis operates in-memory). We’ll use it to ensure no user or IP can overload the system with too many concurrent scans.

In summary, the combination of async FastAPI, external API integrations, and careful use of concurrency will ensure the scanner is relatively fast and can handle multiple simultaneous scans. Caching and batching will reduce redundant calls. If usage grows, scaling out horizontally and employing task queues will be the path to handle high volume.
## <a name="containerization-deployment-strategy"></a>Containerization & Deployment Strategy
We will use **Docker** to containerize each component and **Docker Compose** to orchestrate them together during development and deployment. This ensures consistency across environments (dev, staging, prod) and easy portability.

**Docker Images:** - **Frontend (Next.js):** Base image from ```node:18-alpine```. The Dockerfile will: 
1. Copy``` package.json ```and package-lock.json, run npm install (preferably npm ci for reproducible builds). 
2. Copy the rest of the frontend code. 
3. Build the Next.js app (for production, npm run build which outputs a .next directory). 
4. Use npm start (or next start) to run the production server on port 3000. In dev, we can use npm run dev. 
5. Expose port 3000.\

**For example:**

```dockerfile
# frontend/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npm run build    # build the Next.js app
EXPOSE 3000
CMD ["npm", "run", "start"]   # run the Next.js server
```

- **Backend (FastAPI):** Base image from ```python:3.11-alpine``` (lightweight). Dockerfile:
1. Copy ```requirements.txt``` and run ```pip install -r requirements.txt``` (this will include fastapi, uvicorn, motor, etc.). 
2. Copy the app code. 
3. Expose port 8000 (for Uvicorn). 
4. Command to run:``` e.g. uvicorn app.main:app --host 0.0.0.0 --port 8000. ```In production, we might use Gunicorn for multiple workers. 
5. Ensure to include any needed system packages (if, for example, we generate PDFs, we might need LaTeX or wkhtmltopdf – but likely we stick to CSV or simpler formats to avoid heavy deps). 
***Example:***

```dockerfile    

\# backend/Dockerfile\
FROM python:3.11-alpine\
WORKDIR /app\
COPY``` requirements.txt ```.\
RUN pip install --no-cache-dir -r requirements.txt\
COPY . .\
EXPOSE 8000\
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```
- **Database (MongoDB):** We will use the official ```mongo:6``` Docker image. For dev and testing, we can include it in docker-compose. In production, it could be an externally managed DB or the same container setup. 
- **Cache/Queue (Redis):** If we use Redis for caching or Celery, include ```redis:7-alpine``` image in compose. 
- **Nginx:** We will use Nginx as a reverse proxy and static file server. In Docker Compose, we can have an ```nginx``` service that uses a custom ```nginx.conf```. This container will link to the ```frontend``` and ```backend``` containers. We’ll mount an nginx.conf that routes traffic: 
    - ```/api/*``` ->  FastAPI container ```(http://backend:8000/api/\*```).
    - WebSocket upgrade for /api/ws or similar to backend as well. 
    - All other routes -> Next.js container (http://frontend:3000). 
    - Also serve Next.js static files (Next.js will serve them itself on 3000, or we could do a static export and let Nginx serve, but for SSR we let Next handle it). 
    - Enable gzip compression for responses and maybe caching for static assets. 
    - Configure SSL certificates (in production, we’ll mount the certs from Let’s Encrypt and listen on 443).

**Docker Compose Configuration:**\
A docker-compose.yml will define all services. For example:
```yaml
version: '3'\
services:\
`  `frontend:\
`    `build: ./frontend\
`    `env\_file: .env        # contains NEXT\_PUBLIC\_BASE\_URL, etc.\
`    `ports:\
`      `- "3000:3000"       # only expose in dev; in production, front is behind nginx\
`    `depends\_on:\
`      `- backend\
`    `networks:\
`      `- app-net\
\
`  `backend:\
`    `build: ./backend\
`    `env\_file: .env\
`    `ports:\
`      `- "8000:8000"\
`    `depends\_on:\
`      `- mongo\
`    `networks:\
`      `- app-net\
\
`  `mongo:\
`    `image: mongo:6\
`    `environment:\
`      `MONGO\_INITDB\_DATABASE: wallet\_scanner\_db\
`      `MONGO\_INITDB\_ROOT\_USERNAME: root\
`      `MONGO\_INITDB\_ROOT\_PASSWORD: supersecret\
`    `volumes:\
`      `- mongo\_data:/data/db\
`    `networks:\
`      `- app-net\
\
`  `redis:\
`    `image: redis:7-alpine\
`    `networks:\
`      `- app-net\
\
`  `nginx:\
`    `image: nginx:1.25-alpine\
`    `volumes:\
`      `- ./deploy/nginx.conf:/etc/nginx/conf.d/default.conf:ro\
`      `- ./certs:/etc/nginx/certs:ro            # if using SSL certs\
`    `ports:\
`      `- "80:80"\
`      `- "443:443"\
`    `depends\_on:\
`      `- frontend\
`      `- backend\
`    `networks:\
`      `- app-net\
\
networks:\
`  `app-net:\
`    `driver: bridge\
\
volumes:\
`  `mongo\_data:
```

In **development**, you can run ``````docker-compose up``` --build``` to start everything. This will spin up the Mongo and (if included) Redis, then backend, frontend, and Nginx. You would access the app at http://localhost (Nginx on port 80) or directly http://localhost:3000 for Next or :8000 for API if bypassing Nginx during dev. The compose uses a shared network so that containers can reach each other by name (frontend -> backend as "backend:8000", etc.). Using an ```.env``` file for compose helps define environment-specific settings like dev vs prod API keys, debug mode, etc., without altering the compose file.

**Staging & Production Environments:**\
We will have separate configuration for staging and production: 
- Staging might use a smaller server or a different domain (e.g. staging.example.com) with its own database. We can use a separate ```.env.staging``` and perhaps a ```docker-compose.staging.yml``` (that extends the base compose with any differences, like pulling a specific image version instead of building latest code). 
- Production will use environment variables tuned for security (e.g. ```DEBUG=false```, strict ```CORS```, etc.). It may also use scaled-out replicas. In a simple VPS deployment, we might run the same Docker Compose with ```-d``` (detached) mode and maybe without mapping ports 3000/8000 to host (only expose 80/443 via Nginx).

**Deployment Process:**\
1\. **Provision a VPS** (e.g. Ubuntu 22.04 server) with sufficient resources (CPU, RAM) for running the containers. Install Docker and docker-compose on the server. 2. **Environment Setup:** On the server, create a production ```.env``` file with all necessary secrets and config (never include this in code repo). For example:

  ```ini
MONGO_URI=mongodb://user:pass@mongo:27017/wallet_scanner_db
JWT_SECRET=<random64char>
INFURA_PROJECT_ID=<id>
INFURA_PROJECT_SECRET=<secret>
TATUM_API_KEY=<key>
BLOCKCHAIR_API_KEY=<if required>
```

Also include any Next.js needed vars (though likely only ```NEXT\_PUBLIC\_API\_BASE\_URL``` which would be the domain). 

3. **Build & Push Images:** There are two approaches:
    - Build images on the server directly (simplest: run the same ``````docker-compose up``` --build -d``` with the production env file). 
    - Or build images in CI and push to a registry (like Docker Hub or GitHub Packages) tagged as ```latest``` or a version. Then on server, use ```docker-compose pull && ```docker-compose up``` -d``` to deploy. This is more ```CI/CD``` friendly. 
    - We can outline the simpler route for now: copy the code to server (or git pull) and build on server. 
   
4. **Run Containers:** Use Docker Compose in detached mode for production: ```docker-compose -f docker-compose.yml up -d --build```. This will start all services. Verify containers are running (```docker-compose ps```). The backend should connect to Mongo (which will be initialized by the Mongo container on first run). 
5. **Setup Nginx & HTTPS:** Ensure DNS for your domain points to the VPS. For HTTPS, use Certbot or Let’s Encrypt: 
    - If using the Nginx container approach, one can obtain certs on the host and mount them, or run Certbot in a separate container. A simpler route: run Certbot on host to get ```/etc/letsencrypt``` certificates, then mount that into the Nginx container. Configure ```Nginx.conf``` to use the cert and key (bind to 443 with ssl\_certificate). 
    - Nginx config will also include a redirect from HTTP to HTTPS, and any necessary security headers. Example nginx.conf snippet:

```nginx
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl;
    server_name example.com;
    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_http_version 1.1;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    location / {
        proxy_pass http://frontend:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

The above ensures ```/api``` calls hit FastAPI, and everything else (including Next.js pages and static files) go to the Next.js server. 
6. **Process Management & Restarts:** By using Docker, we rely on Docker’s restart policies. In the compose file, we can add ```restart: always``` to each service so they auto-restart if the process crashes or if the server reboots. This covers what Supervisor or PM2 would normally handle. If we weren’t using Docker, we’d run the Next.js app with PM2 to keep it alive and FastAPI with gunicorn inside a Supervisor or systemd service. But Docker simplifies this by containerizing. 
    - We will also implement healthchecks (Docker Compose supports ```healthcheck``` for services). For example, have the backend container periodically try ```curl localhost:8000/health``` (we can create a simple health endpoint in FastAPI) and restart if unhealthy. 
    - Logging: Docker captures stdout/stderr of containers. For better log management, we might route logs: e.g., mount a volume for backend logs, or use a logging driver to send to syslog. Initially, checking ```docker-compose logs -f backend``` is okay. In production, consider using ELK stack or a hosted logging service to aggregate logs from all containers. 
7. **Staging Deployment:** We mirror the above for staging environment. Possibly use a smaller instance and maybe no scaling. Test the full flow on staging (including scanning functionality with test xpubs and addresses on test networks or small mainnet addresses). Once verified, proceed to prod.

8. **Auto-deployment:** To streamline future updates, consider a CI pipeline that builds the Docker images on push and deploys (via SSH or using something like Portainer or Watchtower to auto-update containers). In absence of that, a manual pull/build as above will suffice.

**Deployment Example Commands:**\
On the server:


```bash
# Pull code (or use scp to copy)
git clone https://github.com/yourrepo/wallet-scanner.git 
cd wallet-scanner

# Create prod env file
nano .env   # fill in secrets

# Build and run containers
```docker-compose up``` -d --build

# (If images are pre-built and pushed)
# docker-compose pull
# ```docker-compose up``` -d

# Set up SSL using certbot (on host)
sudo certbot certonly --standalone -d example.com
# After obtaining certs, copy or mount them into nginx container as in config.

# Restart nginx with SSL
docker-compose restart nginx
```

After this, the app should be live at https://example.com. We’d test the web interface, try a scan, and monitor logs for any errors.
## <a name="essential-dependencies"></a>Essential Dependencies
Here is a list of key dependencies and libraries needed for implementation (to be included in ```requirements.txt``` for Python and ```package.json``` for Node):

**Backend (Python):**\
- **FastAPI** – core web framework for API[\[medium\]](https://medium.com/@pottavijay/creating-a-scalable-full-stack-web-app-with-next-js-and-fastapi-eb4db44f4f4e#:~:text=FastAPI%20).\
- **Uvicorn** – ASGI server to run FastAPI (for dev and used by Gunicorn in prod).\
- **Motor** – Async MongoDB client for non-blocking DB ops[\[mongodb.com\]](https://www.mongodb.com/developer/products/mongodb/8-fastapi-mongodb-best-practices/#:~:text=Motor%C2%A0%E2%80%94%20but%20only%20one%20of,Fortunately%2C%20just%20like).\
- **Python-Jose or PyJWT** – to encode and decode JWT tokens for auth.\
- **Passlib[bcrypt]** – for password hashing (if not using fastapi-users).\
- **HTTPX or AIOHTTP** – async HTTP client for calling blockchain APIs. HTTPX is often used for its simplicity. Retries can be managed via HTTPX’s transport or by ```tenacity```. Aiohttp gives more control if needed.\
- **Tenacity** – for robust retry logic with exponential backoff (or use aiohttp’s retry middleware)[\[brightdata.com\]](https://brightdata.com/blog/web-data/web-scraping-with-aiohttp#:~:text=Asynchronous%20Web%20Scraping%20With%20AIOHTTP,party%20library%20like).\
- **Pydantic** – (installed with FastAPI) for defining request/response models and data validation.\
- **Celery** – (optional) for background job queue. If used, also include ```redis``` (Python package) as broker backend. Alternatively, **FastAPI BackgroundTasks** (no extra dependency) or **arq** (another async job library) could be used.\
- **numpy/pandas** – (optional) if we do heavy data processing for reports (maybe overkill; simple Python can suffice).\
- **matplotlib/Plotly** – (optional) if generating charts server-side for reports (likely not needed, front will handle charts).\
- **reportlab or WeasyPrint** – (optional) if generating PDF reports. Could also output CSV or JSON without extra libs.\
- **Loguru** – (optional) for structured logging.\
- **fastapi-users** – (optional) simplifies auth, comes with OAuth2 and JWT and password hashing prebuilt[\[github.com\]](https://github.com/vintasoftware/nextjs-fastapi-template#:~:text=,environments%20for%20development%20and%20production). We might integrate this to speed up auth implementation.\
- **aiohttp-cors or starlette-cors** – for handling CORS if frontend is on a different domain during dev. In production, likely same domain.\
- **python-dotenv** – to load .env in development (in production, Docker env is passed directly).

**Frontend (Node/Next.js):**\
- **Next.js** – React framework.\
- **React** – underlying library (Next includes it).\
- **chart.js or recharts** – for charts visualization of historical data. Chart.js with a React wrapper (like react-chartjs-2) is a good choice for line/bar charts.\
- **axios or Fetch API** – to call backend APIs. Could use the built-in Fetch API (in Next, fetch is available in ```getServerSideProps``` and on client). Axios is fine too for convenience.\
- **SWR or React Query** – (optional) for data fetching with caching on the client side. Could be useful for polling status or caching results on frontend.\
- **NextAuth** – (optional) if we wanted to integrate a robust auth solution with providers. But here we stick to custom JWT, so not strictly needed.\
- **Tailwind CSS + shadcn/ui** – for UI styling and components (shadcn provides a set of pre-built components on top of Radix and Tailwind, very modern look). Alternatively, **Material-UI (MUI)** or **Ant Design** can be used if preferred. Ant Design has a robust component set and could be useful for tables, forms, etc. (The GoldRush example uses Antd[\[goldrush.dev\]](https://goldrush.dev/guides/building-block-explorers-part-1-multi-chain-block-transaction-explorer/#:~:text=)). Tailwind gives more custom design flexibility.\
- **Socket.IO client** – if we decide to use Socket.IO for realtime (could be overkill; Next can consume raw WebSocket or SSE without it). Possibly we can just use WebSocket API or EventSource for SSE.\
- **date-fns or moment.js** – for date formatting on frontend (to show nice timestamps on charts or logs). date-fns is lightweight.\
- **Jest** – for front-end tests if writing any.\
- **ESLint and Prettier** – to maintain code quality (Next app by default can set these up).\
- **dotenv** – to manage environment vars in development (Next allows a ```.env.local```). We will have env like ```NEXT\_PUBLIC\_API\_URL``` to tell front where backend is (in dev it might be ```http://localhost:8000```, in prod it might be ```/api ```relative to same domain).

Ensure to pin versions for production. Example``` requirements.txt ```snippet:

```makefile
fastapi==0.100.0\
uvicorn==0.22.0\
motor==3.1.1\
python-jose==3.3.0\
passlib[bcrypt]==1.7.4\
httpx==0.24.0\
tenacity==8.2.2
```

And example``` package.json ```dependencies:

```json
"dependencies": {
  "next": "13.4.12",
  "react": "18.2.0",
  "react-dom": "18.2.0",
  "chart.js": "^4.3.0",
  "react-chartjs-2": "^5.0.1",
  "axios": "^1.4.0",
  "zustand": "^4.3.6",
  "tailwindcss": "^3.3.2",
  "@next/font": "13.4.12"
},
"devDependencies": {
  "eslint": "8.x",
  "prettier": "3.x",
  "typescript": "5.x"
}
```

*(Exact versions may differ, but use latest stable in 2025).*
## <a name="development-steps-implementation-plan"></a>Development Steps & Implementation Plan
Finally, we outline a step-by-step plan to implement this project. This will guide an engineer through building the system in a logical sequence:

**Step 1: Repository Setup** – Initialize two separate projects: Next.js app for frontend and FastAPI app for backend. Set up version control (git) with a monorepo or two repos. Create the Dockerfiles for each and a basic docker-compose to wire them up along with Mongo. Verify that ```docker-compose up``` can start a simple Hello World front and back (e.g., backend has a``` /health ```endpoint returning ```“OK”```, front has a default page).

**Step 2: Implement User Authentication (Backend)** – Create the Mongo``` users ```collection and either integrate fastapi-users or write custom endpoints: 
- ```POST /api/register``` to create a new user (hash password, save to DB). 
- ```POST /api/login``` to verify credentials and return JWT (or set cookie). 
- Use Pydantic models for input validation (e.g. email format, password length). 
- Set up password hashing (e.g., using passlib). 
- Generate JWT (PyJWT) with an expiry and include user ID in claims. 
- Add a dependency in FastAPI for protected routes to decode JWT and fetch user. 
- Test these endpoints with dummy data (e.g., via curl or a REST client). Ensure a wrong password yields 401.

**Step 3: Frontend Auth Pages** – Create the login and register pages in Next.js.- Build a simple form and on submit, call the backend API (using fetch or Axios). 
- If successful, store the token. For development, you might store in localStorage (easier to start), but plan to migrate to cookie-based. Alternatively, set up Next.js API route ```/api/login``` that proxies to backend and sets an HttpOnly cookie (this way, cookies can be set from SSR). 
- Implement a React context or hooks to track auth state (e.g., ```useAuth``` to provide current user info and a logout method). 
- Protect dashboard routes: e.g., in Next.js, you can use ```getServerSideProps``` to redirect if no token cookie found. Or use a client-side check with a useEffect (less optimal for initial page load). 
- Test user signup and login via the UI, ensure the token is stored and subsequent API calls include it (like by adding Authorization: Bearer <token> header via Axios interceptor or fetch wrapper).

**Step 4: Scan Endpoint (Backend)** – Implement the core scanning logic on the server for one chain as a prototype (say Bitcoin): 
- Write a service function to scan a single BTC address using Blockchair API (e.g., GET request to Blockchair’s address endpoint). Parse result (maybe just count transactions and total received). 
- Write a placeholder ```POST /api/scan``` that accepts an address and chain. For now, support only “bitcoin” and treat the input as a single address (extended keys handled in next step). 
- This endpoint should verify the user (from JWT), create a scan record in DB (status pending), then either perform the scan synchronously (for initial simplicity) or asynchronously. To start, do it synchronously but within the request (FastAPI can still handle concurrency via await). Return the result (or at least a scan id that was created). 
- Test with a known Bitcoin address (you can use Blockchair’s API to get sample data – e.g., Satoshi’s address). Ensure the FastAPI can reach Blockchair (internet connectivity in container or run it locally). 
- Add error handling (if API fails, return an error message). Also log the event in DB.

**Step 5: Extended Public Key Support & Address Derivation** – Extend the scanning logic to handle xpub/ypub: 
- Integrate or implement BIP32 derivation. Perhaps use the provided``` bip32.py```: test it by feeding a known test xpub to ensure it derives addresses correctly (compare with a known wallet). 
- Modify the scan endpoint to detect if input looks like an xpub (they start with “xpub/ypub/zpub/tpub/etc.”). If so, handle separately: use the derivation logic to generate addresses. 
- Decide on how many addresses to scan by default (maybe 20 at a time, and loop until gap of 20 unused addresses is found). For each batch, call the external API concurrently. Use ```asyncio.gather``` to fetch data for, say, 10 addresses in parallel to avoid hitting rate limits too hard. 
- Mark the scan as ```in\_progress``` and update progress in the DB (you might update a field ```progress\_pct``` or number of addresses done). 
- If using background tasks, you’d schedule this logic in a separate thread or Celery job now. If not yet, running inline with async is okay but could be slow for long xpub – perhaps implement as background using BackgroundTasks:``` BackgroundTasks.add\_task(scan\_xpub\_task, parameters…)``` so the request returns quickly. 
- Test with a known xpub. For instance, Blockchair’s documentation or test vectors could be used. Or generate a new Bitcoin testnet xpub with a known derived address that has some test transactions and see if they’re picked up.

**Step 6: Multi-Chain Integration** – Add support for Ethereum (the other primary chain): 
- Use Infura’s API: you can use their REST endpoints or JSON-RPC. For simplicity, Infura’s JSON-RPC can fetch transactions by address via ```eth\_getBlockByNumber``` and filtering, but that’s complex. Instead, use a blockchain data API for Ethereum if available (Blockchair supports Ethereum addresses too, and so does Tatum). 
- Possibly, use Blockchair for Ethereum as well (Blockchair has an address endpoint for ETH). Or Tatum’s ```getTransactionsByAddress``` for Ethereum (requires API key). 
- Implement an ```ethereum.py``` service that given an address, returns the list of transactions (or at least total count and balance). Ethereum extended public keys aren’t common, so likely just handle single address or a list of addresses if user provided multiple.
- Update the scan endpoint to handle ```chain == "ethereum"```. If an Ethereum address is provided, call the Ethereum service. If by some case an xpub (from a HD wallet following Ethereum’s derivation) is provided, we could derive (though Ethereum’s xpub would derive to many 0x addresses – rarely used concept; we can skip or treat as multiple addresses if needed). 
- Also plan for other chains like maybe **Polygon** or others by mapping them to similar handlers (Polygon can use Tatum with chain parameter, etc.). But focusing on BTC and ETH first is fine. 
- Test Ethereum scan with an address (Infura requires the address’s transactions – maybe use Etherscan’s API as alternative if needed for test). Ensure results are correct (balance matches known explorer).

**Step 7: Frontend – Scanning UI** – Now that backend can start scans, connect the frontend: 
- On the dashboard page, create a form (component ```ScanForm```) with fields: input string, chain dropdown. On submit, call ```POST /api/scan```. If the API immediately returns a scan ID (and status maybe), store that and show progress UI. 
- Implement a simple progress UI: upon starting a scan, navigate to a scan detail page or show a section in dashboard with status. If using WebSockets: 
    - Open a WebSocket to ```ws://backend:8000/ws/scans/{id}``` (for example). Have the backend set up ```@app.websocket("/ws/scans/{id}")``` that pushes updates (like sending JSON``` {"progress": 50}``` or``` {"message": "Scanning address X..."} ```periodically). 
    - In React, use ```useEffectt``` to open the socket and listen for messages, updating component state accordingly. 
- Alternatively, if not using WS yet, implement polling: call ``` GET /api/scan/{id}/status``` every 5 seconds to get the updated status (which backend calculates from DB or internal progress). 
- Display logs: as part of progress, you can show which address is being scanned currently or how many found. The backend can provide some of that info in status. 
- When scan finishes, show a “Completed” status and perhaps navigate to a results view (or populate the UI with results summary).

**Step 8: Results & Visualization** – Once a scan is complete, present the results: 
- Backend: ensure ```GET /api/scan/{id}``` returns detailed results or summary. Possibly include a list of transactions (maybe limited or paginated) and aggregated data for charts (e.g. an array of [date, balance] for each day or blockheight). 
- Frontend: On scan completion, render components to display: 
- - Summary stats (from the scan document: total txs, total received/sent, etc.). 
- Charts: Use the data to render a line chart of balance over time or bar chart of transactions count over months. Libraries like Chart.js can be fed data arrays easily. 
- Transaction list: You could show a table of the most recent transactions with links (links could go to external explorer like Etherscan/Blockchair if they want details). Given time constraints, we might not implement a full explorer UI for each transaction, just enough info. 
- Also provide a “Download Report” button. Implement ```GET /api/scan/{id}/report``` on backend: this function could generate a CSV file with all transactions (columns: date, txid, from, to, amount, fee, etc. – tailor per chain). Use ```csv``` module or pandas to create a CSV in memory and return via ```StreamingResponse``` with ```text/csv ```MIME. Alternatively, generate a PDF summary (using reportlab) for a nicer report. CSV is easier and meets requirement of “download reports.” - Secure the report endpoint so that only the owner of the scan (or an admin) can download.

**Step 9: Security Hardening & Testing** – Now that core features are in place: 
- Review all routes for auth protection. Add ```@app.middleware("http")``` or dependency on all protected endpoints to enforce JWT auth. 
- Test edge cases: invalid addresses (the backend should return 400 if address format is wrong), xpub with no transactions, extremely large histories (maybe try known busy address). 
- Simulate multiple simultaneous scans to see if any race conditions or performance issues (in dev, might use threading to simulate, or just quickly initiate multiple). 
- Ensure rate limiting is configured if possible. Maybe integrate a simple global rate limit (like using ```limits``` library or a custom solution with an in-memory counter for dev). In production, might rely on Nginx rate limit or cloud WAF if available. 
- Run the frontend build in production mode (```npm run build && npm run start```) to ensure no dev-only issues. Check that environment variables are properly picked up (Next.js needs variables in ```.env.production``` or passed via build). 
- Check CORS: If frontend and backend are on same domain behind Nginx, CORS isn’t an issue. If you test backend standalone on localhost:8000 and frontend on 3000, enable CORS in FastAPI for development (```from fastapi.middleware.cors import CORSMiddleware```). In production behind Nginx, the requests are same origin.

**Step 10: Containerization & Compose Setup** – Write the final Dockerfile for both front and back with production settings (no dev dependencies, proper entrypoints). Ensure the docker-compose.yml is configured for production-like environment: 
- Use environment variables (maybe have a separate compose for development that mounts code as volumes for live-reload, and one for production that doesn’t). 
- Test ```docker-compose up --build``` locally: the frontend container should serve the Next.js app, backend container running Uvicorn. You should be able to hit http://localhost (via Nginx container) and see the app, and all interactions working in this containerized environment. 
- Fix any issues (like network connectivity between containers, or environment vars not passed). For example, Next.js might need to know the API URL; in container, backend is http://backend:8000, but from browser it should be ```/api ```since Nginx proxies it. So ensure Next uses relative calls or correct domain. One trick: set ```NEXT\_PUBLIC\_API\_BASE\_URL=""``` (empty) and in code use relative paths (so it hits same domain). This way in dev it can be proxied or you set it to dev URL. 
- Once containers work, tag images (if needed) and prepare for deployment.

**Step 11: Deployment to VPS** – Follow the deployment steps as outlined in the previous section: 
- Set up server, install Docker. 
- - Transfer code or images, set up .env. 
- Start containers with compose. 
- Configure Nginx and SSL. 
- Test the live site. 
- Set up any process monitors (Docker’s restart policies, or a cron job to ensure Docker is running on reboot). 
- Optionally, implement a backup strategy for MongoDB data (regular dumps, etc., since if the container volume is lost, user data would be lost – mount volumes to host or use a managed DB for safety).

**Step 12: Scaling & Future Improvements** – With a running product, note down potential improvements: 
- Add more chains by creating new service modules and mapping them (e.g. add support for **BSC, Solana, XRP, etc.** using Tatum’s API which supports those). 
- Implement more sophisticated analytics: e.g. track token transfers on Ethereum (ERC20, NFTs) by calling Tatum endpoints for tokens. 
- Improve the UI with more features: filtering transactions, searching, etc. 
- Set up monitoring (like using **Prometheus** to scrape a /metrics endpoint from FastAPI or use **Sentry** for error tracking). 
- Write automated tests for critical paths (auth, scan logic with a mocked API so as not to depend on real calls in tests). 
- Optimize performance by adding indexes in Mongo (e.g. index on user\_id in scans collection to quickly find user’s scans). 
- Evaluate costs and rate limits of external APIs; implement a fallback sequence (e.g. try Blockchair, if limit exceeded or fails, try Tatum) to increase reliability.

By following this structured plan, an engineer should be able to implement the multi-chain wallet scanner step-by-step, resulting in a production-ready application. The design choices and best practices we applied (async calls, JWT auth, Docker deployment, etc.) align with modern web development standards, ensuring the system is **secure, scalable, and maintainable** from day one.

**Sources:**

- Blockchair API documentation (multi-blockchain support and xpub scanning)[\[6\]](https://blockchair.com/api/docs#:~:text=,Transaction)[\[1\]](https://blockchair.com/api/docs#:~:text=Blockchair%20API%20provides%20developers%20with,sorting%2C%20and%20aggregating%20blockchain%20data)
- Tatum and Infura capabilities for multi-chain data[\[5\]](https://vocal.media/education/the-top-10-blockchain-api-providers-for-developers-in-2025#:~:text=Overview%3A%20Tatum%20provides%20an%20all,use%20APIs%20for%20multiple%20blockchains)[\[4\]](https://vocal.media/education/the-top-10-blockchain-api-providers-for-developers-in-2025#:~:text=9)
- FastAPI and Next.js integration patterns (JWT auth, WebSockets, caching)[\[8\]](https://medium.com/@pottavijay/creating-a-scalable-full-stack-web-app-with-next-js-and-fastapi-eb4db44f4f4e#:~:text=,managing%20rate%20limits%20in%20FastAPI)
- FastAPI-Mongo async best practices (Motor library usage)[\[7\]](https://www.mongodb.com/developer/products/mongodb/8-fastapi-mongodb-best-practices/#:~:text=FastAPI%20seamlessly%20integrates%20with%20MongoDB,ideal%20for%20creating%20applications%20that)
- Secure auth implementation with fastapi-users (hashed passwords, JWT)[\[10\]](https://github.com/vintasoftware/nextjs-fastapi-template#:~:text=,environments%20for%20development%20and%20production)
- Dockerizing FastAPI & Next.js (compose structure)[\[24\]](https://medium.com/@manzurulhoque/dockerizing-a-fastapi-backend-and-next-js-frontend-part-1-configuring-kubernetes-part-2-920432d1f35f#:~:text=docker)
- Circuit Breaker pattern for external API reliability[\[13\]](https://fmelihh.medium.com/system-design-1-implementing-the-circuit-breaker-pattern-in-fastapi-e96e8864f342#:~:text=Implementing%20a%20Circuit%20Breaker%20provides,several%20key%20benefits)
-----
<a name="citations"></a>[\[1\]](https://blockchair.com/api/docs#:~:text=Blockchair%20API%20provides%20developers%20with,sorting%2C%20and%20aggregating%20blockchain%20data) [\[6\]](https://blockchair.com/api/docs#:~:text=,Transaction) [\[20\]](https://blockchair.com/api/docs#:~:text=,Transaction) Blockchain API Documentation — Blockchair

<https://blockchair.com/api/docs>

[\[2\]](https://vocal.media/education/the-top-10-blockchain-api-providers-for-developers-in-2025#:~:text=7) [\[4\]](https://vocal.media/education/the-top-10-blockchain-api-providers-for-developers-in-2025#:~:text=9) [\[5\]](https://vocal.media/education/the-top-10-blockchain-api-providers-for-developers-in-2025#:~:text=Overview%3A%20Tatum%20provides%20an%20all,use%20APIs%20for%20multiple%20blockchains) The Top 10 Blockchain API Providers for Developers in 2025 | Education

<https://vocal.media/education/the-top-10-blockchain-api-providers-for-developers-in-2025>

[\[3\]](https://medium.com/@pottavijay/creating-a-scalable-full-stack-web-app-with-next-js-and-fastapi-eb4db44f4f4e#:~:text=,managing%20rate%20limits%20in%20FastAPI) [\[8\]](https://medium.com/@pottavijay/creating-a-scalable-full-stack-web-app-with-next-js-and-fastapi-eb4db44f4f4e#:~:text=,managing%20rate%20limits%20in%20FastAPI) [\[18\]](https://medium.com/@pottavijay/creating-a-scalable-full-stack-web-app-with-next-js-and-fastapi-eb4db44f4f4e#:~:text=,managing%20rate%20limits%20in%20FastAPI) [\[19\]](https://medium.com/@pottavijay/creating-a-scalable-full-stack-web-app-with-next-js-and-fastapi-eb4db44f4f4e#:~:text=,throughput%20apps) [\[21\]](https://medium.com/@pottavijay/creating-a-scalable-full-stack-web-app-with-next-js-and-fastapi-eb4db44f4f4e#:~:text=FastAPI%20) Creating a Scalable Full-Stack Web App with Next.js and FastAPI | by Vijay Potta (pottavijay) | Medium

<https://medium.com/@pottavijay/creating-a-scalable-full-stack-web-app-with-next-js-and-fastapi-eb4db44f4f4e>

[\[7\]](https://www.mongodb.com/developer/products/mongodb/8-fastapi-mongodb-best-practices/#:~:text=FastAPI%20seamlessly%20integrates%20with%20MongoDB,ideal%20for%20creating%20applications%20that) [\[15\]](https://www.mongodb.com/developer/products/mongodb/8-fastapi-mongodb-best-practices/#:~:text=Motor%C2%A0%E2%80%94%20but%20only%20one%20of,Fortunately%2C%20just%20like) 8 Best Practices for Building FastAPI and MongoDB Applications | MongoDB

<https://www.mongodb.com/developer/products/mongodb/8-fastapi-mongodb-best-practices/>

[\[9\]](https://fastapi.tiangolo.com/tutorial/bigger-applications/#:~:text=Bigger%20Applications%20,them%20to%20the%20main%20app) Bigger Applications - Multiple Files - FastAPI

<https://fastapi.tiangolo.com/tutorial/bigger-applications/>

[\[10\]](https://github.com/vintasoftware/nextjs-fastapi-template#:~:text=,environments%20for%20development%20and%20production) GitHub - vintasoftware/nextjs-fastapi-template: State of the art project template that integrates Next.js, Zod, FastAPI for full-stack TypeScript + Python projects.

<https://github.com/vintasoftware/nextjs-fastapi-template>

[\[11\]](https://github.com/BloodLuust/masterpig/blob/4717bb49c20c574c973966b1e1fdb64e31ef4a20/app/bip32.py#L6-L14) [\[12\]](https://github.com/BloodLuust/masterpig/blob/4717bb49c20c574c973966b1e1fdb64e31ef4a20/app/bip32.py#L260-L269) bip32.py

<https://github.com/BloodLuust/masterpig/blob/4717bb49c20c574c973966b1e1fdb64e31ef4a20/app/bip32.py>

[\[13\]](https://fmelihh.medium.com/system-design-1-implementing-the-circuit-breaker-pattern-in-fastapi-e96e8864f342#:~:text=Implementing%20a%20Circuit%20Breaker%20provides,several%20key%20benefits) [\[14\]](https://fmelihh.medium.com/system-design-1-implementing-the-circuit-breaker-pattern-in-fastapi-e96e8864f342#:~:text=%E2%9C%85%20Prevents%20cascading%20failures%20%E2%80%94,services%20that%20are%20already%20struggling) System Design (1) — Implementing the Circuit Breaker Pattern in FastAPI | by F. Melih Ercan | Medium

<https://fmelihh.medium.com/system-design-1-implementing-the-circuit-breaker-pattern-in-fastapi-e96e8864f342>

[\[16\]](https://medium.com/@adityakolpe/python-asynchronous-programming-with-asyncio-and-aiohttp-186378526b01#:~:text=Here%2C%20each%20retry%20attempt%20waits,the%20server%20with%20frequent%20retries) Python Asynchronous Programming — asyncio and aiohttp - Medium

<https://medium.com/@adityakolpe/python-asynchronous-programming-with-asyncio-and-aiohttp-186378526b01>

[\[17\]](https://www.pythoncentral.io/aiohttp-guide-to-asynchronous-http-in-python/#:~:text=AIOHTTP%3A%20Guide%20to%20Asynchronous%20HTTP,to%20benefit%20from%20connection) AIOHTTP: Guide to Asynchronous HTTP in Python

<https://www.pythoncentral.io/aiohttp-guide-to-asynchronous-http-in-python/>

[\[22\]](https://brightdata.com/blog/web-data/web-scraping-with-aiohttp#:~:text=Asynchronous%20Web%20Scraping%20With%20AIOHTTP,party%20library%20like) Asynchronous Web Scraping With AIOHTTP in Python - Bright Data

<https://brightdata.com/blog/web-data/web-scraping-with-aiohttp>

[\[23\]](https://goldrush.dev/guides/building-block-explorers-part-1-multi-chain-block-transaction-explorer/#:~:text=) Build a Multi-Chain Block Explorer in 20 Minutes | Guides | GoldRush

<https://goldrush.dev/guides/building-block-explorers-part-1-multi-chain-block-transaction-explorer/>

[\[24\]](https://medium.com/@manzurulhoque/dockerizing-a-fastapi-backend-and-next-js-frontend-part-1-configuring-kubernetes-part-2-920432d1f35f#:~:text=docker) Dockerizing a FastAPI Backend and Next.js Frontend (Part 1) | by Manjurul Hoque Rumi | Medium

<https://medium.com/@manzurulhoque/dockerizing-a-fastapi-backend-and-next-js-frontend-part-1-configuring-kubernetes-part-2-920432d1f35f>
