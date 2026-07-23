/**
 * Groundwork — GST & income-tax overlay (NZ).
 *
 * This is an ADDITIVE layer over the pre-tax engine (engine.ts). The base
 * `runOption` result is unchanged (and stays verified against spec §9); this
 * module takes that result plus tax settings and returns after-tax figures and
 * a GST position. Keeping it separate means the pre-tax core stays simple and
 * the tax assumptions are all in one, clearly-labelled place.
 *
 * INDICATIVE ONLY. NZ tax on development is fact-specific — entity, association,
 * bright-line, change-of-use, and the GST treatment of the original purchase all
 * matter. Confirm any real decision with a tax adviser. Assumptions are listed
 * in `notes` on every result so the user can see exactly what was applied.
 *
 * Model choices (all configurable via TaxInputs):
 *  - Development profit on SOLD sections is taxable income (a subdivision is a
 *    taxable activity / profit-making scheme). Cost of sales = allocated land
 *    basis + allocated civil + allocated dev-loan interest; selling costs are
 *    already netted in the base `sectionNet`.
 *  - Retained homes are capital assets: their build is NOT expensed against sale,
 *    and their capital growth is NOT taxed (no CGT; assumes held beyond the
 *    bright-line period). Net rental income IS taxed each year; interest is
 *    deductible (2026 restored full deductibility). Building depreciation is nil
 *    in NZ; chattels depreciation is ignored (conservative — flagged).
 *  - GST: if registered, section sales carry 15% output GST and GST on civil (and
 *    build-for-sale) is reclaimable; residential-rental (retained) homes make an
 *    EXEMPT supply, so GST on their build is NOT recoverable — a real added cost.
 *    If NOT registered, there is no output GST and no input claims, so the base
 *    ex-GST treatment is adjusted back to a GST-inclusive basis.
 */

import type { Assumptions, Deal, Result } from "./engine";

export interface TaxInputs {
  incomeTaxRate: number; // 0.28 company / 0.33 trust / 0.39 top personal
  gstRegistered: boolean; // registered (or will register) for the development?
  purchaseGst: "zero-rated" | "claimed" | "second-hand" | "none";
  heldGst: "exempt" | "change-of-use"; // GST treatment of the retained rental homes
}

/** Defaults: 28% company rate, and the example deal's answers (not registered,
 *  bought privately, retained homes exempt). Note: at this sale scale GST
 *  registration is normally COMPULSORY — see `notes`/`warning`. */
export const DEFAULT_TAX: TaxInputs = {
  incomeTaxRate: 0.28,
  gstRegistered: false,
  purchaseGst: "none",
  heldGst: "exempt",
};

/**
 * UI intake for tax/GST. GST answers are NOT carried between projects — they
 * start blank and must be confirmed for each new project. `incomeTaxRate` keeps
 * a sensible default (28%) since it rarely changes per deal.
 */
export interface TaxIntake {
  incomeTaxRate: number;
  gstRegistered: "" | "yes" | "no";
  purchaseGst: "" | TaxInputs["purchaseGst"];
  heldGst: "" | TaxInputs["heldGst"];
}

// Defaults to the realistic common case so the tool shows real, tax-inclusive
// numbers out of the box (a subdivision at this scale is normally GST-registered).
// Still confirmed per project on the options step — these are a starting point.
export const DEFAULT_TAX_INTAKE: TaxIntake = {
  incomeTaxRate: 0.28,
  gstRegistered: "yes",
  purchaseGst: "zero-rated",
  heldGst: "exempt",
};

/** True once every GST question has been answered for this project. */
export const gstAnswered = (t: TaxIntake): boolean =>
  t.gstRegistered !== "" && t.purchaseGst !== "" && t.heldGst !== "";

/** Resolve the intake into concrete engine inputs (safe fallbacks for any blanks). */
export function resolveTax(t: TaxIntake): TaxInputs {
  return {
    incomeTaxRate: t.incomeTaxRate,
    gstRegistered: t.gstRegistered === "yes",
    purchaseGst: (t.purchaseGst || "none") as TaxInputs["purchaseGst"],
    heldGst: (t.heldGst || "exempt") as TaxInputs["heldGst"],
  };
}

export interface GstPosition {
  registered: boolean;
  outputOnSales: number; // GST collected on section sales, payable to IRD
  inputReclaim: number; // GST reclaimed on civil (+ build-for-sale)
  heldBuildGstCost: number; // unrecoverable GST on retained (exempt) homes
  net: number; // net cash GST effect of the chosen treatment vs the pre-tax base
  warning?: string;
}

export interface TaxResult {
  incomeTaxDev: number; // tax on development profit (sold sections)
  devTaxableProfit: number;
  incomeTaxRentalYr1: number; // year-1 rental income tax
  afterTaxNet1: number; // completion cash after dev tax + GST treatment
  afterTaxFreshCash: number;
  afterTaxWealth: number[];
  afterTaxNw10: number;
  afterTaxCagr: number;
  afterTaxBeats: number;
  gst: GstPosition;
  notes: string[];
}

const gstOn = (inclGST: number, gstRate: number): number => inclGST - inclGST / (1 + gstRate);

export function applyTax(deal: Deal, a: Assumptions, r: Result, tax: TaxInputs): TaxResult {
  // Holding the raw site triggers no taxable events (no sale, no rent, no GST)
  // until it's later sold or developed. After-tax == pre-tax.
  if (r.holdAsIs) {
    return {
      incomeTaxDev: 0,
      devTaxableProfit: 0,
      incomeTaxRentalYr1: 0,
      afterTaxNet1: 0,
      afterTaxFreshCash: 0,
      afterTaxWealth: r.wealth,
      afterTaxNw10: r.nw10,
      afterTaxCagr: r.cagr,
      afterTaxBeats: r.beats,
      gst: { registered: tax.gstRegistered, outputOnSales: 0, inputReclaim: 0, heldBuildGstCost: 0, net: 0 },
      notes: ["Holding the raw site — no sale, rent or GST events until it is sold or developed."],
    };
  }

  const g = deal.gstRate;
  const soldShare = deal.lots > 0 ? r.soldN / deal.lots : 0;
  const buildHeld = a.build * r.heldN;
  const heldValue = a.homeVal * r.heldN;
  const interest = r.heldDebt * a.intRate;
  const notes: string[] = [];

  // ── GST position ──
  const soldGrossIncl = r.oneLine
    ? deal.saleInOneLineInclGST
    : (deal.grossRealisationInclGST / deal.lots) * r.soldN;

  let outputOnSales = 0;
  let inputReclaim = 0;
  let heldBuildGstCost = 0;
  let gstNet = 0;
  let warning: string | undefined;

  if (tax.gstRegistered) {
    // Registered: base engine already works ex-GST, so output/input net out in
    // the margin. The only real cash leakage is unrecoverable GST on the
    // retained homes' build if they make an exempt (residential rent) supply.
    outputOnSales = gstOn(soldGrossIncl, g);
    inputReclaim = deal.civilCost * g * soldShare; // civil GST attributable to taxable (sold) supply
    if (r.heldN > 0 && tax.heldGst === "exempt") {
      heldBuildGstCost = buildHeld * g;
      gstNet -= heldBuildGstCost;
      notes.push(
        `Retained homes make an exempt (residential-rent) supply, so GST of ${Math.round(
          heldBuildGstCost,
        ).toLocaleString("en-NZ")} on their build is not recoverable — a real cost.`,
      );
    } else if (r.heldN > 0) {
      notes.push("Retained homes: GST claimed through build with a change-of-use adjustment assumed neutral.");
    }
    notes.push("GST-registered: section sales carry output GST; GST on civil is reclaimable — nets out in the ex-GST margin.");
  } else {
    // Not registered: no output GST handed to IRD (proceeds keep the full price)
    // but no input claims either (civil + build cost carry unrecoverable GST).
    const outputKept = gstOn(soldGrossIncl, g); // benefit: not paid to IRD
    const civilGstCost = deal.civilCost * g; // cost: cannot reclaim
    const buildGstCost = buildHeld * g; // cost: cannot reclaim
    heldBuildGstCost = buildGstCost;
    gstNet = outputKept - civilGstCost - buildGstCost;
    warning =
      "Selling multiple sections is normally a taxable activity, so GST registration is usually COMPULSORY at this scale. Modelling as unregistered may overstate returns — confirm with a tax adviser.";
    notes.push(
      `Not GST-registered: keeps ${Math.round(outputKept).toLocaleString(
        "en-NZ",
      )} of output GST but forgoes ${Math.round(civilGstCost + buildGstCost).toLocaleString(
        "en-NZ",
      )} of input credits on civil + build.`,
    );
    notes.push(warning);
  }

  // Purchase-GST note (affects basis / historic credit, not current cash here)
  const purchaseNote: Record<TaxInputs["purchaseGst"], string> = {
    "zero-rated": "Land purchased zero-rated (going concern): no GST on acquisition.",
    claimed: "GST input credit claimed on the land purchase (already received historically).",
    "second-hand": "Second-hand goods credit may apply to the purchase — not modelled in cash here; confirm eligibility.",
    none: "No GST claimed on the (private) purchase.",
  };
  notes.push(purchaseNote[tax.purchaseGst]);

  const gst: GstPosition = {
    registered: tax.gstRegistered,
    outputOnSales,
    inputReclaim,
    heldBuildGstCost,
    net: gstNet,
    warning,
  };

  // ── Income tax: development profit on sold sections ──
  const landCostSold = a.basis * soldShare;
  const civilSold = deal.civilCost * soldShare;
  const devInterestSold = r.devInterest * soldShare;
  const devTaxableProfit = Math.max(0, r.sectionNet - landCostSold - civilSold - devInterestSold);
  const incomeTaxDev = tax.incomeTaxRate * devTaxableProfit;
  notes.push(
    `Development profit on the ${r.soldN} sold section${r.soldN === 1 ? "" : "s"} taxed at ${(
      tax.incomeTaxRate * 100
    ).toFixed(0)}%: taxable profit ${Math.round(devTaxableProfit).toLocaleString("en-NZ")}.`,
  );

  // ── Completion cash after tax + GST treatment ──
  const afterTaxNet1 = r.net1 - incomeTaxDev + gstNet;
  const afterTaxFreshCash = Math.max(0, -afterTaxNet1);

  // ── Income tax: rental, over the horizon ──
  const rentalTax1 = tax.incomeTaxRate * Math.max(0, r.NOI1 - interest);
  const incomeTaxRentalYr1 = rentalTax1;
  if (r.heldN > 0) {
    notes.push(
      `Net rental income taxed at ${(tax.incomeTaxRate * 100).toFixed(0)}% each year (interest deductible); capital growth on retained homes is untaxed (assumes held beyond the bright-line).`,
    );
  }

  // ── After-tax wealth trajectory ──
  const eq0 = r.eq0;
  let cash = afterTaxNet1;
  let homes = heldValue;
  const wealth: number[] = [eq0];
  for (let t = 1; t <= a.horizon; t++) {
    wealth.push(homes - r.heldDebt + cash);
    const nrPre = r.NOI1 * Math.pow(1 + a.rentG, t - 1) - interest;
    const nrAfter = nrPre - tax.incomeTaxRate * Math.max(0, nrPre);
    cash = cash * (1 + a.hurdle) + nrAfter;
    homes *= 1 + a.capG;
  }
  const afterTaxNw10 = wealth[wealth.length - 1];
  const afterTaxCagr = Math.pow(afterTaxNw10 / Math.max(eq0, 1), 1 / a.horizon) - 1;
  const afterTaxBeats = afterTaxCagr - a.hurdle;

  return {
    incomeTaxDev,
    devTaxableProfit,
    incomeTaxRentalYr1,
    afterTaxNet1,
    afterTaxFreshCash,
    afterTaxWealth: wealth,
    afterTaxNw10,
    afterTaxCagr,
    afterTaxBeats,
    gst,
    notes,
  };
}
