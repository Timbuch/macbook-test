# Groundwork

**Development feasibility, financing & capital-strategy tool** — McKenzie & Co.

A developer uploads a market valuation and a subdivision scheme plan. Groundwork reads
them, runs a short consultative chat to draw out the owner's real options and money-side
inputs, then models each path and produces a **capital-strategy analysis**: the actual
cash-on-cash requirement, whether the rentals service the debt at today's rates (ICR), a
10-year wealth horizon, and how each option compares to the owner's opportunity cost.

The question it answers is not "is this feasible" (it usually is) — it's **capital
allocation**: how much cash each path ties up, how liquid the owner stays, and whether
holding rentals actually beats banking the cash and investing it elsewhere.

## Status

- ✅ Financial engine (`src/engine.ts`) — verified against the spec §9 worked example (`npm test`).
- ⬜ Web UI, discovery chat, PDF extraction, tax & sensitivity layers, export — see [CLAUDE.md](CLAUDE.md).

## Getting started

```bash
npm install
npm test
```

See [docs/GROUNDWORK-BUILD-SPEC.md](docs/GROUNDWORK-BUILD-SPEC.md) for the full spec and
[docs/prototype.html](docs/prototype.html) for the working reference prototype (open in a browser).
