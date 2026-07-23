/**
 * Time-phased development cashflow — the monthly ledger a lender wants: how debt
 * is drawn and repaid over the works + sell-down programme, the peak funding
 * requirement, capitalised construction interest, and a real equity IRR.
 *
 * This is a more precise lens than the single-point completion used elsewhere;
 * it does NOT change the verified pre-tax engine, it sits alongside it.
 *
 * Model per month:
 *  - Existing mortgage sits on the land from month 0 (accrues at mortgageRate).
 *  - Civil + build are drawn evenly over the works period on a development loan
 *    (at devRate), or funded from equity if devFund = "cash".
 *  - Construction interest is capitalised into the loan each month.
 *  - Sold sections settle over the sell-down window; proceeds repay the dev loan
 *    then the mortgage; any surplus is distributed to equity.
 *  - At completion, retained homes are refinanced (heldDebt drawn) to repay debt;
 *    their remaining equity (value − heldDebt) is a terminal distribution.
 *  Equity IRR is solved on the resulting monthly owner cashflows and annualised.
 */
import type { Assumptions, Deal, Result } from "./engine";
import { equityToday } from "./engine";

export interface TimelinePoint {
  month: number;
  debt: number; // outstanding mortgage + dev loan at month end
  equityCF: number; // owner cash flow this month (− in, + out)
}

export interface Timeline {
  points: TimelinePoint[];
  peakDebt: number;
  peakMonth: number;
  totalInterest: number;
  distributions: number; // total cash returned to the owner
  equityIn: number; // equity committed at start
  multiple: number; // distributions / equity in (equity multiple)
  irr: number | null; // annualised equity IRR (null if not solvable)
  months: number;
}

/** Sell-down window in months after completion, from the intake choice. */
export function sellMonthsFor(mode: "atonce" | "staged" | "bulk", soldN: number): number {
  if (mode === "staged") return Math.max(0, Math.ceil(soldN * 1.5));
  return 0; // at-once / bulk settle at completion
}

/** Lots settling each month (index 0..N). */
function settlementSchedule(soldN: number, devMonths: number, sellMonths: number, N: number): number[] {
  const s = new Array(N + 1).fill(0);
  if (soldN <= 0) return s;
  if (sellMonths <= 0) {
    s[devMonths] += soldN;
    return s;
  }
  for (let i = 0; i < soldN; i++) {
    const m = devMonths + Math.round((i * sellMonths) / Math.max(1, soldN - 1));
    s[Math.min(m, N)]++;
  }
  return s;
}

function irrMonthly(cf: number[]): number | null {
  const npv = (rate: number) => cf.reduce((s, c, i) => s + c / Math.pow(1 + rate, i), 0);
  let lo = -0.9999;
  let hi = 5;
  let flo = npv(lo);
  let fhi = npv(hi);
  if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null; // no sign change
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    const fm = npv(mid);
    if (Math.abs(fm) < 1e-4) return mid;
    if (flo * fm < 0) {
      hi = mid;
      fhi = fm;
    } else {
      lo = mid;
      flo = fm;
    }
  }
  return (lo + hi) / 2;
}

export function timeline(deal: Deal, a: Assumptions, r: Result, sellMonths: number): Timeline | null {
  if (r.holdAsIs) return null; // no development programme

  const devMonths = Math.max(1, a.devMonths);
  const N = devMonths + sellMonths;
  const eq0 = equityToday(deal, a);
  const civilBuild = deal.civilCost + a.build * r.heldN;
  const drawPM = a.devFund === "debt" ? civilBuild / devMonths : 0;
  const cashPM = a.devFund === "cash" ? civilBuild / devMonths : 0;
  const perLotNet = r.soldN > 0 ? r.sectionNet / r.soldN : 0;
  const schedule = settlementSchedule(r.soldN, devMonths, sellMonths, N);

  let mort = a.mortgage;
  let dev = 0;
  let peakDebt = mort;
  let peakMonth = 0;
  let totalInterest = 0;
  let distributions = 0;

  const cf = new Array(N + 1).fill(0);
  cf[0] = -eq0; // equity committed at the start
  const points: TimelinePoint[] = [{ month: 0, debt: mort, equityCF: cf[0] }];

  for (let m = 1; m <= N; m++) {
    // interest on opening balances, capitalised
    const interest = mort * (a.mortgageRate / 12) + dev * (a.devRate / 12);
    totalInterest += interest;
    dev += interest;

    if (m <= devMonths) {
      if (drawPM) dev += drawPM;
      if (cashPM) cf[m] -= cashPM; // owner funds works from cash
    }

    // completion: refinance retained homes to repay works debt
    if (m === devMonths && r.heldN > 0) {
      let refi = r.heldDebt;
      const rd = Math.min(dev, refi);
      dev -= rd;
      refi -= rd;
      const rm = Math.min(mort, refi);
      mort -= rm;
      refi -= rm;
      cf[m] += refi;
      distributions += refi;
    }

    // section settlements
    const lots = schedule[m];
    if (lots > 0) {
      let proceeds = perLotNet * lots;
      const rd = Math.min(dev, proceeds);
      dev -= rd;
      proceeds -= rd;
      const rm = Math.min(mort, proceeds);
      mort -= rm;
      proceeds -= rm;
      cf[m] += proceeds;
      distributions += proceeds;
    }

    const debt = mort + dev;
    if (debt > peakDebt) {
      peakDebt = debt;
      peakMonth = m;
    }
    points.push({ month: m, debt, equityCF: cf[m] });
  }

  // terminal: retained equity (mark-to-market) less any residual debt
  const retainedEquity = r.heldN > 0 ? a.homeVal * r.heldN - r.heldDebt : 0;
  const residual = mort + dev;
  const terminal = retainedEquity - residual;
  cf[N] += terminal;
  if (terminal > 0) distributions += terminal;
  points[points.length - 1].equityCF = cf[N];

  const monthly = irrMonthly(cf);
  const irr = monthly != null ? Math.pow(1 + monthly, 12) - 1 : null;

  return {
    points,
    peakDebt,
    peakMonth,
    totalInterest,
    distributions,
    equityIn: eq0,
    multiple: eq0 > 0 ? distributions / eq0 : 0,
    irr,
    months: N,
  };
}
