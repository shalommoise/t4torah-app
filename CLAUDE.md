# CLAUDE.md — t4torah-app

Node.js / Express 5 / MySQL (mysql2) / Jest + supertest. CommonJS.
Structure: `src/routes` → `src/controllers` → `src/models` (SQL) / `src/services` (logic).

## Running tests

- `npm run test:ci` — the suite to run before every commit. No database needed: tests mock `src/models/*` with `jest.mock`.
- `npm run test:integration` — needs a live MySQL; do not rely on it in unattended runs.
- Never use `npm test` in automation: it runs Jest in `--watch` mode and never exits.

## Conventions

- Match the existing style: small functions, async/await, parameterised SQL (`?` placeholders) only.
- New logic gets unit tests in `__tests__/`. Mock models and any sender; never hit the network in tests.
- Keep controllers thin; put logic in `src/services/`.
