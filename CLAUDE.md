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

---

## Unattended work: `feature/send-automation`

This branch is being built by scheduled, unattended Claude Code runs. Each run follows these rules.

### Hard rules

1. Work only on branch `feature/send-automation`. Never commit to, merge into, rebase onto or push `master`.
2. Never create, read, commit or print `.env` or any real credential. Config goes in `.env.example` with placeholder values.
3. No code may send real email or WhatsApp messages. The only senders allowed are the console/file (dry-run) senders and mocks. Anything that could reach a real provider must be behind `SEND_MODE=live` and must not be implemented beyond an interface stub.
4. Do not run `npm run seed`, `db/setup.sql`, or anything that connects to a database. Schema changes are allowed as additions to `db/setup.sql` only (new tables/columns), described in PROGRESS.md.
5. Do not modify `db/data/*` or `imgs/*`.
6. New runtime dependencies: avoid. If one is truly needed, note why in PROGRESS.md. No global installs.
7. `npm run test:ci` must pass before every commit. Never commit failing tests, and never delete or `.skip` an existing test to make the suite pass.

### Per-run procedure

1. `git fetch origin feature/send-automation` and make sure the working copy is up to date with it.
2. Read `BACKLOG.md` and the latest entries in `PROGRESS.md`.
3. Take the first unchecked `[ ]` item. Complete **at most 3 items** per run.
4. For each item: implement → add tests → `npm run test:ci` → one commit per item (message: `send-automation: <item id> <short title>`) → tick it `[x]` in BACKLOG.md in the same commit.
5. If an item is blocked or ambiguous, mark it `[!]` with a one-line reason, pick a sensible default if one exists and note it, otherwise move to the next item. Do not stop the whole run for one blocked item.
6. Append a PROGRESS.md entry (date/time, items done, decisions made, anything the owner should review), commit, and push `feature/send-automation`.
7. If every item is `[x]` or `[!]`, write a final summary entry in PROGRESS.md and make no further changes.
