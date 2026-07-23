# Groundwork — Build Specification & Handover

**Product:** Groundwork — a development feasibility, financing and capital-strategy tool for McKenzie & Co.
**Format:** Static web app (SWA).
**Status:** Working single-file HTML prototype exists (`groundwork-feasibility-tool-prototype.html`). This document is the spec to build the production version.
**Author of spec:** scoped with Tim Buchanan, McKenzie & Co. · July 2026.

> Read this alongside the prototype. The prototype is the reference implementation of the flow and the financial engine — every formula below is already working JavaScript in that file. Use it to verify your build against the worked example in section 9.

---

## 1. What the tool does

A developer (e.g. Ed, who owns the Clevedon 8-lot site) uploads a **market valuation** and a **subdivision scheme plan**. The tool:

1. Reads both PDFs and drafts a structured deal.
2. Runs a short **chat that confirms the deal and leads the owner to articulate their real options** — sell everything, or keep some lots for long-term growth.
3. Captures the money-side inputs a valuation never contains: current mortgage, how the build is funded, target rents, and the owner's next best use of the cash.
4. Models each option and produces a **capital-strategy analysis**: the actual cash-on-cash requirement, whether the rentals service the debt at today's rates (ICR), a 10-year wealth horizon, and how each option compares to the owner's opportunity cost.

The point of the tool is **not** "is this feasible" (it usually is). It is **capital allocation**: how much of the owner's cash each path ties up, how liquid they stay, and whether holding rentals actually beats banking the cash and investing it elsewhere.

---

## 2. Tech stack (recommended)

- **Static web app** — no server state required for the core model; everything computes client-side. Deploy to Azure Static Web Apps (McK is on Azure) or similar.
- **Front end:** keep it simple. The prototype is vanilla HTML/CSS/JS + Chart.js. For production, React + TypeScript is fine, but the engine should be a **pure, framework-agnostic TypeScript module** (`engine.ts`) with no DOM dependencies so it can be unit-tested and reused (Excel export, API, etc.).
- **Charts:** Chart.js (used in prototype) or Recharts.
- **PDF extraction:** server-side function (Azure Function) calling an LLM with vision + a text-layer fallback. This is the only part that needs a back end.
- **Branding:** McKenzie & Co brand — Aptos typeface; colours Moss `#48773C`, Wood `#3D3935`, Water `#ABC6CA`, Sand `#D2CDBE`. Square corners, subtle shadows. (See prototype `:root` variables.)

---

## 3. User flow (4 steps)

| Step | Screen | Purpose |
|------|--------|---------|
| 1 | **Upload** | Drop valuation + scheme plan. Extraction runs, produces draft `Deal`. |
| 2 | **Confirm & explore** | Chat verifies the deal AND draws out the strategy options + money-side inputs. |
| 3 | **Options & finance** | Pre-selected options from the chat; all assumptions editable. |
| 4 | **Capital analysis** | Recommendation, KPIs, 10-yr wealth chart, cash-vs-yield chart, ICR/serviceability table, per-option waterfall, side-by-side table. |

A **Developer spec mode** toggle in the prototype reveals inline data-model/engine notes on each screen — keep an equivalent so the model stays transparent to McK staff.

---

## 4. Data model

### 4.1 `Deal` (from the valuation + plan)

```ts
interface Lot { id: number; areaSqm: number; ratePerSqm: number; valueInclGST: number; }

interface Deal {
  address: string;
  zoning: string;
  siteAreaSqm: number;
  consentStatus: "approved" | "lodged" | "none";
  lots: Lot[];                       // n titles
  asIsValue: number;                 // "as is" market value, ex GST basis
  grossRealisationInclGST: number;   // sum of individual section values, incl GST
  saleInOneLineInclGST: number;      // one-line/bulk value, incl GST
  civilCost: number;                 // civil + development works to create titles
  gstRate: number;                   // 0.15
  commission: number;                // agent commission on section sales (e.g. 0.0275)
  marketingLegalPerLot: number;      // e.g. 3000
  // provenance
  sourcePages: Record<string, number>;
  confidence: Record<string, "high" | "low">;
}
```

### 4.2 `Assumptions` (from chat + editable on Step 3)

```ts
interface Assumptions {
  // existing position
  mortgage: number;          // current debt on the land
  mortgageRate: number;      // e.g. 0.06
  basis: number;             // owner's cost basis in the land
  // development funding
  devFund: "debt" | "cash";  // how civil + build is funded
  devRate: number;           // development finance rate, e.g. 0.085
  devMonths: number;         // dev/build period, e.g. 12
  // serviceability (today)
  intRate: number;           // actual funding rate, e.g. 0.0575
  testRate: number;          // bank servicing stress rate, e.g. 0.07
  reqICR: number;            // required interest cover, e.g. 1.25
  refiLVR: number;           // max LVR on retained homes, e.g. 0.65
  // build & rental
  build: number;             // build cost per home
  homeVal: number;           // completed home value
  rentWk: number;            // rent per home per week
  opex: number;              // operating costs as % of rent, e.g. 0.22
  vacancy: number;           // e.g. 0.05
  rentG: number;             // rent growth p.a., e.g. 0.03
  capG: number;              // capital growth p.a., e.g. 0.04
  // opportunity cost
  hurdle: number;            // next-best-use return, e.g. 0.10
  horizon: number;           // years, e.g. 10
  keepN: number;             // homes to build & keep (Option C)
}
```

### 4.3 `Result` (engine output per option)

```ts
interface Result {
  key: string; name: string;
  heldN: number; soldN: number; oneLine: boolean;
  heldDebt: number;            // debt supportable on kept homes
  binding: "ICR" | "LVR" | "—";
  icr: number | null;          // achieved ICR at test rate
  freshCash: number;           // NEW owner cash required after recycling sales + debt + repaying mortgage
  equityLocked: number;        // illiquid owner equity sitting in the rentals
  cashYield: number | null;    // year-1 net rent / equityLocked
  netRent1: number;            // year-1 rent after interest at ACTUAL rate (<0 ⇒ top-up)
  devInterest: number;
  net1: number;                // completion cash to owner (>0 surplus, <0 fresh cash)
  wealth: number[];            // net worth by year, wealth[0..horizon]
  nw10: number;                // net worth at horizon
  cagr: number;                // compound growth of net worth from equityToday
  beats: number;               // cagr − hurdle
  items: [string, number, "pos"|"neg"][]; // completion waterfall lines
}
```

---

## 5. Extraction pipeline (Step 1)

- Each uploaded PDF → document-understanding step (LLM w/ vision + text-layer parse fallback).
- Map to the `Deal` object. Each field carries `confidence` and `sourcePage`.
- Low-confidence fields (in the Clevedon case: civil cost, and anything derived from the residual) are flagged for the chat to confirm.
- Store raw PDFs + extracted JSON against a `projectId`.
- Financing defaults (`intRate`, `testRate`, `reqICR`) should come from a **rates config** that can be refreshed (RBNZ OCR + bank rate table), not hard-coded — see section 8.

**The valuation reconciliation table is the key extraction target.** In the Clevedon valuation it gives: 8 lots with area, $/m² and value; gross realisation incl GST; sale-in-one-line; and the residual analysis (civil/development cost breakdown, selling costs, profit & risk, holding costs). Parse the residual's cost lines into `civilCost`.

---

## 6. The discovery chat (Step 2)

The chat has two jobs, not one:

1. **Confirm** the extracted deal in plain language (lots, consent, values, civil cost).
2. **Lead the owner to name their real options and supply the money-side inputs.** This is deliberately consultative — it asks what they're *trying to do* before it models anything.

Question sequence (each answer patches `Deal`/`Assumptions` and updates the live intent panel):

1. Confirm the deal basics. → verify `Deal`
2. Confirm civil/dev cost. → `civilCost`
3. **"Sell all, or keep a couple for long-term growth?"** → sets the strategy direction
4. **"How many would you keep — 2, or stretch to 3–4?"** → `keepN`, selects options A + C
5. Rent & completed value for kept homes. → `rentWk`, `homeVal`
6. **"What's the current mortgage on the land?"** → `mortgage`
7. **"Fund the civil & build with cash or a development loan?"** → `devFund`
8. Apply today's bank settings (rate / test rate / ICR)? → confirms `intRate`, `testRate`, `reqICR`
9. **"If you didn't do this, what's your next best use of the cash?"** → `hurdle` (+ benchmark type)
10. Wrap: reflect back the option set to be modelled.

The chat should show a **typing indicator** while composing and a clear **"waiting for your reply"** affordance on the quick-reply chips (the prototype's next iteration adds this). Free-text answers must also patch the model, not just the scripted quick-replies — in production, route each answer through an LLM that extracts the relevant field(s).

**Options produced by the chat** map to engine configs:

| Card | Config |
|------|--------|
| A · Sell all 8 | `{ heldN: 0, oneLine: false }` |
| B · Sell in one line | `{ heldN: 0, oneLine: true }` |
| C · Sell (8−keepN) · keep keepN | `{ heldN: keepN, oneLine: false }` |
| D · Keep all 8 | `{ heldN: 8, oneLine: false }` |

---

## 7. Financial engine (the core)

All figures **GST-exclusive internally, before tax**. Convert at the boundary using `gstRate`. Each option is scored by one pure function `runOption(deal, assumptions, config) → Result`.

### 7.1 Section sale proceeds

```
grossPerLot = grossRealisationInclGST / lots
soldN       = lots − heldN

if oneLine:
  selling    = saleInOneLineInclGST × 0.015
  sectionNet = exGST(saleInOneLineInclGST) − selling
else:
  grossSold  = grossPerLot × soldN
  selling    = grossSold × commission + marketingLegalPerLot × soldN
  sectionNet = exGST(grossSold) − selling
```

### 7.2 Retained homes — build, value, income

```
buildHeld = build × heldN
heldValue = homeVal × heldN
NOI1      = rentWk × 52 × heldN × (1 − vacancy) × (1 − opex)   // year-1 net operating income
```

### 7.3 Debt sizing — **the key mechanic** (LVR vs ICR)

The bank lends the **lower** of the LVR limit and what the rent services at the stress rate:

```
lvrDebt = refiLVR × heldValue
icrDebt = NOI1 / (testRate × reqICR)          // serviceability limit
heldDebt = min(lvrDebt, icrDebt)
binding  = icrDebt < lvrDebt ? "ICR" : "LVR"
icr      = NOI1 / (heldDebt × testRate)        // achieved cover
```

On low-yield residential (Clevedon: ~3% gross), **ICR binds** — the bank lends well below the LVR ceiling, which forces the owner to leave more of their own equity in the deal. This is the single most important behaviour in the model; make sure it is visible in the UI.

### 7.4 Development funding & completion cash

```
devInterest = devFund == "debt"
              ? (civilCost + buildHeld) × 0.5 × devRate × (devMonths / 12)   // avg utilisation
              : 0

net1 = sectionNet + heldDebt − civilCost − buildHeld − mortgage − devInterest
```

- `net1 > 0` ⇒ **surplus cash** returned to the owner at completion.
- `net1 < 0` ⇒ **fresh cash** the owner must inject: `freshCash = max(0, −net1)`.
- `equityLocked = heldValue − heldDebt` (illiquid equity in the rentals).

### 7.5 Serviceability at today's actual rate

```
netRent1 = NOI1 − heldDebt × intRate      // NOTE: actual rate, not test rate
cashYield = heldN > 0 ? netRent1 / equityLocked : null
```

If `netRent1 < 0` the portfolio needs an **annual cash top-up** even though it passed the bank's ICR test (the test rate is higher than the actual rate, so passing the test doesn't guarantee positive cashflow — but here the ICR-limited debt is low enough that it usually is positive).

### 7.6 10-year wealth trajectory

Net worth starts at the owner's **equity today** and evolves. Cash compounds at the hurdle (opportunity cost of liquid cash); homes grow at capital growth; net rent accrues.

```
equityToday = asIsValue × 0.98 − mortgage     // liquid equity if they did nothing/sold as-is

cash  = net1
homes = heldValue
wealth[0] = equityToday
for t = 1..horizon:
  wealth[t] = homes − heldDebt + cash
  nr   = NOI1 × (1 + rentG)^(t−1) − heldDebt × intRate
  cash = cash × (1 + hurdle) + nr
  homes = homes × (1 + capG)

nw10 = wealth[horizon]
cagr = (nw10 / equityToday)^(1/horizon) − 1
beats = cagr − hurdle
```

### 7.7 Opportunity-cost benchmark

```
benchmark[t] = equityToday × (1 + hurdle)^t
```

Plotted as a dashed line on the wealth chart. Benchmark presets: property fund (default 10%), repay mortgage (= `mortgageRate`), term deposit (~4%), custom.

---

## 8. Default inputs (grounded)

### 8.1 Deal defaults — from the Bayleys valuation (140 Papakura-Clevedon Rd, 15 Dec 2025)

| Field | Value |
|------|------|
| Lots | 8 (556–624 m²) |
| As-is value | $2,500,000 +GST |
| Gross realisation (individual sections) | $5,515,000 incl GST |
| Sale in one line | $4,475,000 incl GST |
| Civil / development cost | ~$905,000 |
| Commission / marketing+legal | 2.75% / $3,000 per lot |

### 8.2 Financing defaults — NZ market, July 2026 (make these a refreshable config)

| Field | Value | Basis |
|------|------|------|
| OCR | 2.50% | RBNZ, July 2026 |
| Actual funding rate | 5.75% | investor lending (~5.2–5.5% fixed + investor margin) |
| Servicing test rate | 7.0% | bank stress rates 6.4–7.0% residential |
| Required ICR | 1.25 | commercial DSCR/ICR 1.20–1.35 |
| Development finance rate | 8.5% | dev/construction margin |
| Refinance LVR (held homes) | 65% | typical investment LVR |

### 8.3 Owner / strategy defaults (confirmed in chat for Clevedon)

| Field | Value |
|------|------|
| Current mortgage / rate | $1,500,000 / 6.0% |
| Cost basis in land | $1,900,000 |
| Dev funding | Development loan |
| Build cost / completed value | $435,000 / $1,350,000 per home |
| Rent / opex / vacancy | $780/wk / 22% of rent / 5% |
| Rent growth / capital growth | 3% / 4% p.a. |
| Next best use (hurdle) / horizon | Property fund 10% / 10 years |
| Homes to keep (Option C) | 2 |

---

## 9. Worked example — verify your build against these

Engine outputs with the section 8 defaults. **Equity today = $950,000** (as-is $2.45M net − $1.5M mortgage). Benchmark at 10% → **$2,464,055** in 10 years.

| Option | heldDebt | Binding | Fresh cash | Equity locked | Yr-1 cash yield | Completion cash (net1) | Net wealth yr10 | CAGR |
|--------|---------:|:-------:|-----------:|--------------:|:---------------:|-----------------------:|----------------:|-----:|
| A · Sell all 8 | 0 | — | 0 | 0 | — | +$2,176,527 | $5,132,137 | 18.4% |
| B · Sell in one line | 0 | — | 0 | 0 | — | +$1,380,717 | $3,255,658 | 13.1% |
| C · Keep 2 | $686,971 | ICR | 0 | $2,013,029 | 1.0% | +$801,525 | $5,413,901 | 19.0% |
| C · Keep 4 | $1,373,941 | ICR | $573,477 | $4,026,059 | 1.0% | −$573,477 | $5,695,664 | 19.6% |
| D · Keep all 8 | $2,747,882 | ICR | $3,323,480 | $8,052,118 | 1.0% | −$3,323,480 | $6,259,191 | 20.7% |

**How to read it:** every option beats the 10% hurdle (development adds the value). The real trade-off is liquidity — keeping more homes builds slightly more 10-year wealth but ties up progressively more of Ed's cash at a ~1% cash yield, and beyond ~2 homes he has to inject fresh cash. This is the story the tool exists to tell.

---

## 10. Outputs / dashboard (Step 4)

1. **Recommendation banner** — plain-language read, opportunity-cost aware.
2. **KPI row** — fresh cash needed, equity locked up, net wealth at horizon, beats-hurdle-by.
3. **10-year net wealth chart** — one line per option + dashed benchmark.
4. **Cash-vs-yield chart** — stacked bars (fresh cash + equity locked) with a cash-yield overlay.
5. **Serviceability / ICR table** — net rent, max debt, what's binding, achieved ICR, cashflow after interest, self-funding vs top-up.
6. **Per-option completion waterfall** — money in/out, ending in surplus or fresh-cash-required.
7. **Side-by-side comparison table.**
8. **Export** — branded McK PDF + the underlying Excel model.

---

## 11. Open decisions / gaps before it is decision-grade

These are deliberately **not** in the prototype and should be scoped with the team:

1. **Tax.** The model is before-tax. NZ rental interest-deductibility rules, depreciation, and entity structure (personal vs LTC vs company) materially change the hold options. This is the biggest gap. Add a tax layer with configurable entity + deductibility settings.
2. **Realised vs unrealised return.** Hold options' "wealth" includes unrealised equity and mark-to-market growth. Present realised cash return and total return separately; consider a proper project **IRR/XIRR** on dated cash flows rather than a single CAGR.
3. **Sensitivity.** The result hinges on `capG` vs `hurdle`. Add a sensitivity view (capital growth × hurdle grid, and tornado on rent, build cost, sale price).
4. **Sell-down timing & holding costs.** The prototype treats completion as a single point. Model the section sell-down period (Clevedon valuation assumes ~1 lot / 1.5 months) and holding costs during it.
5. **GST detail.** Handle GST on going-concern vs taxable supplies, and on build-to-hold vs build-to-sell, properly rather than a flat divide.
6. **Debt amortisation.** Currently interest-only. Offer P&I as an option.
7. **Staged / partial refinance and equity release timing.** Model the revalue event on title issue explicitly on a monthly cash series.
8. **Multiple hold counts at once.** Let the user compare keep-2 and keep-4 side by side (chat already hints at this).

---

## 12. Suggested build order

1. `engine.ts` — pure module implementing section 7. Unit-test against the section 9 table. **Do this first.**
2. Step 3 + Step 4 (options, assumptions, dashboard) wired to the engine.
3. Step 2 chat — scripted first, then LLM-backed field extraction from free text.
4. Step 1 extraction pipeline (Azure Function + LLM).
5. Tax + sensitivity layers (section 11).
6. Branded PDF / Excel export.

---

## 13. Sources for financing defaults

- Opes Partners — current NZ mortgage rates: https://opespartners.co.nz/mortgage/interest-rates
- Opes Partners — servicing test rates: https://opespartners.co.nz/mortgage/servicing-test-rates
- Calculate.co.nz — NZ mortgage lending rules (LVR, DTI, serviceability): https://calculate.co.nz/reference/nz-mortgage-lending-rules.php

*Rates as at July 2026. Treat as a refreshable config, not constants.*
