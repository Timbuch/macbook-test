/**
 * Groundwork — development feasibility & capital-strategy engine.
 *
 * Pure, framework-agnostic module. No DOM, no I/O. Every figure is
 * GST-exclusive internally and before tax; convert at the boundary with `gstRate`.
 *
 * This is a faithful port of the reference prototype's `runOption`
 * (docs/prototype.html) and is verified against the worked example in
 * docs/GROUNDWORK-BUILD-SPEC.md §9 by engine.test.ts. Change a formula here
 * and the test tells you if it drifts from the reference.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Deal {
  address: string;
  lots: number;                    // number of titles
  asIsValue: number;               // "as is" market value (GST-exclusive basis)
  grossRealisationInclGST: number; // sum of individual section values, incl GST
  saleInOneLineInclGST: number;    // one-line / bulk value, incl GST
  civilCost: number;               // civil + development works to create titles
  gstRate: number;                 // e.g. 0.15
  commission: number;              // agent commission on section sales, e.g. 0.0275
  marketingLegalPerLot: number;    // e.g. 3000
}

export interface Assumptions {
  // existing position
  mortgage: number;      // current debt on the land
  mortgageRate: number;  // e.g. 0.06
  basis: number;         // owner's cost basis in the land
  // development funding
  devFund: "debt" | "cash";
  devRate: number;       // development finance rate, e.g. 0.085
  devMonths: number;     // dev/build period, e.g. 12
  // serviceability (today)
  intRate: number;       // actual funding rate, e.g. 0.0575
  testRate: number;      // bank servicing stress rate, e.g. 0.07
  reqICR: number;        // required interest cover, e.g. 1.25
  refiLVR: number;       // max LVR on retained homes, e.g. 0.65
  // build & rental
  build: number;         // build cost per home
  homeVal: number;       // completed home value
  rentWk: number;        // rent per home per week
  opex: number;          // operating costs as % of rent, e.g. 0.22
  vacancy: number;       // e.g. 0.05
  rentG: number;         // rent growth p.a., e.g. 0.03
  capG: number;          // capital growth p.a., e.g. 0.04
  // opportunity cost
  hurdle: number;        // next-best-use return, e.g. 0.10
  horizon: number;       // years, e.g. 10
}

export interface OptionConfig {
  key: string;
  name: string;
  heldN: number;         // homes built & kept
  oneLine: boolean;      // sell the sold lots in one line?
  holdAsIs?: boolean;    // don't develop at all — hold the raw site, appreciating at capG
}

export type WaterfallItem = [label: string, amount: number, sign: "pos" | "neg"];

export interface Result {
  key: string;
  name: string;
  heldN: number;
  soldN: number;
  oneLine: boolean;               // sold the sold lots in one line?
  holdAsIs: boolean;              // no development — raw site held and appreciating
  sectionNet: number;             // ex-GST section proceeds after selling costs
  heldDebt: number;               // debt supportable on kept homes
  binding: "ICR" | "LVR" | "—";
  icr: number | null;             // achieved ICR at test rate
  freshCash: number;              // new owner cash required (after sales, debt, mortgage repay)
  equityLocked: number;           // illiquid owner equity sitting in the rentals
  cashYield: number | null;       // year-1 net rent / equityLocked
  netRent1: number;               // year-1 rent after interest at ACTUAL rate (<0 ⇒ top-up)
  NOI1: number;                   // year-1 net operating income
  devInterest: number;
  net1: number;                   // completion cash to owner (>0 surplus, <0 fresh cash)
  wealth: number[];               // net worth by year, wealth[0..horizon]
  nw10: number;                   // net worth at horizon
  cagr: number;                   // compound growth of net worth from equityToday
  beats: number;                  // cagr − hurdle
  topups: number;                 // cumulative annual cash top-ups over the horizon
  eq0: number;                    // equity today
  items: WaterfallItem[];         // completion waterfall lines
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const exGST = (inclGST: number, gstRate: number): number => inclGST / (1 + gstRate);

/** Liquid equity today if the owner did nothing / sold as-is (2% disposal allowance). */
export const equityToday = (deal: Deal, a: Assumptions): number =>
  deal.asIsValue * 0.98 - a.mortgage;

// ─── Core ──────────────────────────────────────────────────────────────────

export function runOption(deal: Deal, a: Assumptions, cfg: OptionConfig): Result {
  const eq0Today = equityToday(deal, a);

  // "Hold as-is": no subdivision, no sale, no build. The raw site is kept and
  // rides the wider property market at the capital-growth rate, net of the
  // mortgage. No income (mortgage interest assumed serviced from elsewhere).
  if (cfg.holdAsIs) {
    const wealth: number[] = [eq0Today];
    for (let t = 1; t <= a.horizon; t++) {
      wealth.push(deal.asIsValue * Math.pow(1 + a.capG, t) - a.mortgage);
    }
    const nw10 = wealth[wealth.length - 1];
    const cagr = Math.pow(nw10 / Math.max(eq0Today, 1), 1 / a.horizon) - 1;
    return {
      key: cfg.key,
      name: cfg.name,
      heldN: 0,
      soldN: 0,
      oneLine: false,
      holdAsIs: true,
      sectionNet: 0,
      heldDebt: 0,
      binding: "—",
      icr: null,
      freshCash: 0,
      equityLocked: eq0Today, // all equity stays illiquid in the raw land
      cashYield: null,
      netRent1: 0,
      NOI1: 0,
      devInterest: 0,
      net1: 0,
      wealth,
      nw10,
      cagr,
      beats: cagr - a.hurdle,
      topups: 0,
      eq0: eq0Today,
      items: [["No transaction — site held as-is", 0, "pos"]],
    };
  }

  const heldN = cfg.heldN;
  const soldN = deal.lots - heldN;
  const grossPerLot = deal.grossRealisationInclGST / deal.lots;

  // 7.1 Section sale proceeds
  let sectionNet: number, selling: number;
  if (cfg.oneLine) {
    selling = deal.saleInOneLineInclGST * 0.015;
    sectionNet = exGST(deal.saleInOneLineInclGST, deal.gstRate) - selling;
  } else {
    const grossSold = grossPerLot * soldN;
    selling = grossSold * deal.commission + deal.marketingLegalPerLot * soldN;
    sectionNet = exGST(grossSold, deal.gstRate) - selling;
  }

  // 7.2 Retained homes — build, value, income
  const buildHeld = a.build * heldN;
  const heldValue = a.homeVal * heldN;
  const NOI1 = a.rentWk * 52 * heldN * (1 - a.vacancy) * (1 - a.opex);

  // 7.3 Debt sizing — min(LVR, ICR)
  const lvrDebt = a.refiLVR * heldValue;
  const icrDebt = heldN > 0 ? NOI1 / (a.testRate * a.reqICR) : 0;
  const heldDebt = heldN > 0 ? Math.min(lvrDebt, icrDebt) : 0;
  const binding: Result["binding"] =
    heldN > 0 ? (icrDebt < lvrDebt ? "ICR" : "LVR") : "—";
  const icr = heldN > 0 ? NOI1 / (heldDebt * a.testRate) : null;

  // 7.4 Development funding & completion cash
  const devInterest =
    a.devFund === "debt"
      ? (deal.civilCost + buildHeld) * 0.5 * a.devRate * (a.devMonths / 12)
      : 0;
  const net1 = sectionNet + heldDebt - deal.civilCost - buildHeld - a.mortgage - devInterest;
  const freshCash = Math.max(0, -net1);
  const equityLocked = heldValue - heldDebt;

  // 7.5 Serviceability at today's actual rate
  const netRent1 = NOI1 - heldDebt * a.intRate;
  const cashYield = heldN > 0 ? netRent1 / equityLocked : null;

  // 7.6 10-year wealth trajectory
  const eq0 = equityToday(deal, a);
  let cash = net1;
  let homes = heldValue;
  let topups = 0;
  const wealth: number[] = [eq0];
  for (let t = 1; t <= a.horizon; t++) {
    wealth.push(homes - heldDebt + cash);
    const nr = NOI1 * Math.pow(1 + a.rentG, t - 1) - heldDebt * a.intRate;
    if (nr < 0) topups += -nr;
    cash = cash * (1 + a.hurdle) + nr;
    homes *= 1 + a.capG;
  }
  const nw10 = wealth[wealth.length - 1];
  const cagr = Math.pow(nw10 / Math.max(eq0, 1), 1 / a.horizon) - 1;
  const beats = cagr - a.hurdle;

  // completion waterfall
  const items: WaterfallItem[] = [];
  if (cfg.oneLine) {
    items.push(
      ["Sale in one line (ex GST)", exGST(deal.saleInOneLineInclGST, deal.gstRate), "pos"],
      ["Selling costs (1.5%)", -selling, "neg"],
    );
  } else {
    items.push(
      [`${soldN} sections sold (ex GST)`, exGST(grossPerLot * soldN, deal.gstRate), "pos"],
      ["Selling costs", -selling, "neg"],
    );
  }
  if (heldN > 0) items.push([`Debt drawn on ${heldN} kept homes`, heldDebt, "pos"]);
  items.push(["Civil & development works", -deal.civilCost, "neg"]);
  if (buildHeld > 0) items.push([`Build cost — ${heldN} homes`, -buildHeld, "neg"]);
  if (a.mortgage > 0) items.push(["Repay current mortgage", -a.mortgage, "neg"]);
  if (devInterest > 0) items.push(["Development loan interest", -devInterest, "neg"]);

  return {
    key: cfg.key,
    name: cfg.name,
    heldN,
    soldN,
    oneLine: cfg.oneLine,
    holdAsIs: false,
    sectionNet,
    heldDebt,
    binding,
    icr,
    freshCash,
    equityLocked,
    cashYield,
    netRent1,
    NOI1,
    devInterest,
    net1,
    wealth,
    nw10,
    cagr,
    beats,
    topups,
    eq0,
    items,
  };
}

/**
 * Development / project return — the classic feasibility view, distinct from the
 * 10-year wealth trajectory. Land goes in at its current market value (as-is), so
 * `profit` is the value the DEVELOPMENT creates over and above simply holding the
 * land. Pre-tax, ex-GST (engine basis).
 */
export interface ProjectReturn {
  gdv: number;           // gross development value: net sale proceeds + retained homes' value
  landIn: number;        // land at current market (as-is) value
  devCost: number;       // civil + build + development finance interest
  tdc: number;           // total development cost = landIn + devCost
  profit: number;        // gdv − tdc
  marginOnCost: number;  // profit / tdc
  marginOnGdv: number;   // profit / gdv
  equityInvested: number; // developer's committed cash: land equity + any fresh cash in
  cashOnCash: number | null; // profit / equityInvested (leveraged return on cash)
}

export function projectReturn(deal: Deal, a: Assumptions, r: Result): ProjectReturn {
  // Holding the raw site is not a development — there's no project margin.
  if (r.holdAsIs) {
    return { gdv: 0, landIn: deal.asIsValue, devCost: 0, tdc: 0, profit: 0, marginOnCost: 0, marginOnGdv: 0, equityInvested: 0, cashOnCash: null };
  }
  const landIn = deal.asIsValue;
  const buildCost = a.build * r.heldN;
  const heldValue = a.homeVal * r.heldN;
  const gdv = r.sectionNet + heldValue; // ex-GST net proceeds from sold lots + retained value
  const devCost = deal.civilCost + buildCost + r.devInterest;
  const tdc = landIn + devCost;
  const profit = gdv - tdc;
  const equityInvested = Math.max(0, deal.asIsValue - a.mortgage) + r.freshCash;
  return {
    gdv,
    landIn,
    devCost,
    tdc,
    profit,
    marginOnCost: tdc > 0 ? profit / tdc : 0,
    marginOnGdv: gdv > 0 ? profit / gdv : 0,
    equityInvested,
    cashOnCash: equityInvested > 0 ? profit / equityInvested : null,
  };
}

/** Opportunity-cost benchmark line: equity today compounded at the hurdle. */
export function benchmark(deal: Deal, a: Assumptions): number[] {
  const eq0 = equityToday(deal, a);
  return Array.from({ length: a.horizon + 1 }, (_, t) => eq0 * Math.pow(1 + a.hurdle, t));
}
