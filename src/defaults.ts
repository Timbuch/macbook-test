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

/** Option cards → engine configs. `keepN` selects the C option's held count. */
export function optionSet(keepN = 2): OptionConfig[] {
  return [
    { key: "A", name: "Sell all 8", heldN: 0, oneLine: false },
    { key: "B", name: "Sell in one line", heldN: 0, oneLine: true },
    { key: "C", name: `Sell ${8 - keepN} · keep ${keepN}`, heldN: keepN, oneLine: false },
    { key: "D", name: "Keep all 8", heldN: 8, oneLine: false },
  ];
}
