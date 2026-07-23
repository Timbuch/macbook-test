# Groundwork — build notes for Claude Code

Development feasibility, financing & capital-strategy tool for McKenzie & Co.
Full spec: [docs/GROUNDWORK-BUILD-SPEC.md](docs/GROUNDWORK-BUILD-SPEC.md). Reference
implementation: [docs/prototype.html](docs/prototype.html) (a working single-file prototype —
every formula in the engine already runs there).

## The one rule for this repo

**`src/engine.ts` is the source of truth for the numbers, and `src/engine.test.ts`
guards it.** The test asserts the exact figures in spec §9. If you touch a formula,
`npm test` tells you immediately whether it still matches the reference prototype.
Never "fix" a number by editing the test to match a changed engine without confirming
the engine is right — the §9 table is the agreed truth.

## Layout

- `src/engine.ts` — pure, DOM-free, before-tax model. `runOption(deal, assumptions, cfg) → Result`.
- `src/defaults.ts` — grounded §8 defaults (Clevedon deal + July-2026 NZ finance). Finance
  block is meant to be a **refreshable config**, not constants.
- `src/engine.test.ts` — verifies against §9. Keep it green.

## Commands

```bash
npm test          # run engine verification
npm run typecheck # tsc --noEmit
```

## Conventions

- All money is **GST-exclusive and before-tax internally**; convert at the boundary with `gstRate`.
- Debt on retained homes = `min(LVR limit, ICR/serviceability limit)`. On low-yield NZ
  residential the **ICR limb binds** — this is the whole point of the tool; keep it visible in any UI.
- Reuse the McK foundation, not a bespoke stack: chrome from `mck-foundation`, `@mck/secure`,
  `mck-claude-proxy` for the PDF-extraction Function. Brand = Aptos; Moss `#48773C`, Wood
  `#3D3935`, Water `#ABC6CA`, Sand `#D2CDBE`.

## Build order (spec §12)

1. ✅ `engine.ts` + tests against §9 — **done, green.**
2. UI: Step 3 (options & assumptions) + Step 4 (dashboard) wired to the engine (Vite + React + TS → Azure SWA).
3. Step 2 discovery chat — scripted first, then LLM-backed field extraction.
4. Step 1 extraction pipeline (Azure Function + LLM via `mck-claude-proxy`).
5. Tax + sensitivity layers (spec §11) — the biggest gaps before it is decision-grade.
6. Branded PDF / Excel export.

## Known limitations (before it is decision-grade — spec §11)

Before-tax, interest-only, single-point completion. Treat hold-option returns as indicative
until the tax layer (NZ interest-deductibility, depreciation, entity structure) lands.
