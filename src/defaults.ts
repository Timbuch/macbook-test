/**
 * Grounded default inputs (docs/GROUNDWORK-BUILD-SPEC.md §8).
 *
 * Deal defaults come from the Bayleys valuation of 140 Papakura-Clevedon Rd
 * (15 Dec 2025). Financing defaults are the NZ market as at July 2026 and are
 * intended to be a REFRESHABLE config (RBNZ OCR + bank rate table), not constants.
 */
import type { Assumptions, Deal, OptionConfig } from "./engine";

export const CLEVEDON_DEAL: Deal = {
  address: "140 Papakura-Clevedon Road, Clevedon",
  lots: 8,
  asIsValue: 2_500_000,
  grossRealisationInclGST: 5_515_000,
  saleInOneLineInclGST: 4_475_000,
  civilCost: 905_000,
  gstRate: 0.15,
  commission: 0.0275,
  marketingLegalPerLot: 3_000,
};

/** NZ financing market, July 2026 — treat as refreshable config. */
export const DEFAULT_FINANCE = {
  intRate: 0.0575, // actual investor funding rate
  testRate: 0.07, // bank servicing stress rate
  reqICR: 1.25, // required interest cover
  refiLVR: 0.65, // max LVR on retained homes
  devRate: 0.085, // development finance rate
  devMonths: 12,
} as const;

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  mortgage: 1_500_000,
  mortgageRate: 0.06,
  basis: 1_900_000,
  devFund: "debt",
  devRate: DEFAULT_FINANCE.devRate,
  devMonths: DEFAULT_FINANCE.devMonths,
  intRate: DEFAULT_FINANCE.intRate,
  testRate: DEFAULT_FINANCE.testRate,
  reqICR: DEFAULT_FINANCE.reqICR,
  refiLVR: DEFAULT_FINANCE.refiLVR,
  build: 435_000,
  homeVal: 1_350_000,
  rentWk: 780,
  opex: 0.22,
  vacancy: 0.05,
  rentG: 0.03,
  capG: 0.04,
  hurdle: 0.10,
  horizon: 10,
};

// ── "Next best use of the money" — the plain-language comparison basis ──
// (replaces the "hurdle rate" jargon). Each strategy's 10-year result is measured
// against leaving the freed-up cash in whichever of these the owner would pick.

export type BenchmarkType = "fund" | "mortgage" | "termdeposit" | "custom";

export const BENCHMARKS: Record<BenchmarkType, { label: string; short: string; rate: number | null; blurb: string }> = {
  fund: { label: "A property / managed fund", short: "a property fund", rate: 0.10, blurb: "Typical ~10% p.a." },
  mortgage: { label: "Paying down the mortgage", short: "paying down the mortgage", rate: null, blurb: "Guaranteed return = your mortgage rate." },
  termdeposit: { label: "A term deposit", short: "a term deposit", rate: 0.04, blurb: "Safe ~4% p.a." },
  custom: { label: "Something else (set the rate)", short: "your next best option", rate: null, blurb: "Enter the return you could otherwise earn." },
};

// ── Sale & delivery intake (asked of the tool's user; feed the base deal) ──

export type SalesChannel = "agent" | "private" | "tender" | "inhouse";
export type SellDown = "atonce" | "staged" | "bulk";
export type WhoBuilds = "contractor" | "developer" | "unsure";

/** Sales channel → selling-cost model (commission + per-lot marketing/legal). */
export const SALES_CHANNELS: Record<SalesChannel, { label: string; commission: number; marketingLegalPerLot: number }> = {
  agent: { label: "Licensed real estate agent", commission: 0.0275, marketingLegalPerLot: 3_000 },
  private: { label: "Private sale (no agent)", commission: 0, marketingLegalPerLot: 2_500 },
  tender: { label: "Tender / deadline sale", commission: 0.0275, marketingLegalPerLot: 8_000 },
  inhouse: { label: "Developer's in-house team", commission: 0.01, marketingLegalPerLot: 4_000 },
};

/** Apply the chosen sales channel to a deal, returning an effective deal. */
export function withSalesChannel(deal: Deal, channel: SalesChannel): Deal {
  const c = SALES_CHANNELS[channel];
  return { ...deal, commission: c.commission, marketingLegalPerLot: c.marketingLegalPerLot };
}

/** Option cards → engine configs. `keepN` selects the C option's held count. */
export function optionSet(keepN = 2): OptionConfig[] {
  return [
    { key: "A", name: "Sell all 8", heldN: 0, oneLine: false },
    { key: "B", name: "Sell in one line", heldN: 0, oneLine: true },
    { key: "C", name: `Sell ${8 - keepN} · keep ${keepN}`, heldN: keepN, oneLine: false },
    { key: "D", name: "Keep all 8", heldN: 8, oneLine: false },
  ];
}
