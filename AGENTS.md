# Repository Guidelines

## Project Structure & Module Organization
- `wallet-scanner-frontend/`: Next.js + TypeScript app (pages, API routes, assets). Key folders: `pages/`, `public/`, `styles/`.
- `hashapp/`: Python prototyping/scripts (e.g., `hashapp/main.py`).
- `recovery-site/` and `wallet-scanner/`: planning/docs; no active runtime code yet.
- Root docs: `README.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`.

## Build, Test, and Development Commands
- Frontend dev: `cd wallet-scanner-frontend && npm run dev` — start Next.js on `http://localhost:3000`.
- Frontend build: `npm run build` — production build (Turbopack).
- Frontend serve: `npm run start` — run compiled app.
- Lint: `npm run lint` — ESLint with `next/core-web-vitals` + TypeScript.
- Python script: `python main.py` or `python hashapp/main.py` — run quick prototypes.

## Coding Style & Naming Conventions
- TypeScript/React: 2-space indent; strict typing (see `tsconfig.json`).
- Components: PascalCase (`MyWidget.tsx`), hooks/utilities: camelCase (`useFeature.ts`).
- Pages: route-based filenames in `pages/` (e.g., `pages/index.tsx`, `pages/api/hello.ts`).
- ESLint: follow reported fixes; prefer functional components and React 19 conventions.
- Python: PEP 8, 4-space indent; module names snake_case.

## Testing Guidelines
- Currently no test framework configured. If adding logic, include lightweight tests and usage examples in PRs.
- Recommended (if introducing tests): Jest/Vitest + React Testing Library under `wallet-scanner-frontend/__tests__/` with `*.test.ts(x)` naming.
- Aim for meaningful coverage on new code paths; avoid flaky or network‑dependent tests.

## Commit & Pull Request Guidelines
- Commits: prefer Conventional Commits (e.g., `feat:`, `fix:`, `docs:`). The history includes both conventional and free‑form; consistency is appreciated.
- PRs: include
  - concise description and scope
  - linked issues (e.g., `Closes #123`)
  - screenshots/GIFs for UI changes
  - notes on testing and any follow‑ups
- Pre-submit: run `npm run lint` (frontend) and verify builds pass locally.

## Security & Configuration Tips
- Read `SECURITY.md` and use the project ethically (watch‑only defaults). Avoid committing secrets; prefer `.env.local` for dev.
- New APIs or crypto-related code must include rationale, input validation, and failure modes in the PR description.
