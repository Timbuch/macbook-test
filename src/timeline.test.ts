import { describe, expect, it } from "vitest";
import { runOption } from "./engine";
import { CLEVEDON_DEAL, DEFAULT_ASSUMPTIONS, optionSet } from "./defaults";
import { sellMonthsFor, timeline } from "./timeline";

const deal = CLEVEDON_DEAL;
const a = DEFAULT_ASSUMPTIONS;
const opt = (k: string) => optionSet(2).find((o) => o.key === k)!;

describe("timeline / IRR", () => {
  it("hold-as-is has no development timeline", () => {
    expect(timeline(deal, a, runOption(deal, a, opt("E")), 0)).toBeNull();
  });

  it("Sell all 8 — peak debt, positive IRR, profitable distributions", () => {
    const r = runOption(deal, a, opt("A"));
    const t = timeline(deal, a, r, sellMonthsFor("atonce", r.soldN))!;
    expect(t.peakDebt).toBeGreaterThan(a.mortgage); // mortgage + dev loan drawn
    expect(t.totalInterest).toBeGreaterThan(0); // construction interest accrues
    expect(t.irr).not.toBeNull();
    expect(t.irr!).toBeGreaterThan(0);
    expect(t.distributions).toBeGreaterThan(t.equityIn); // returns more than the equity in
  });

  it("staged sell-down runs longer than at-once", () => {
    const r = runOption(deal, a, opt("A"));
    const atOnce = timeline(deal, a, r, sellMonthsFor("atonce", r.soldN))!;
    const staged = timeline(deal, a, r, sellMonthsFor("staged", r.soldN))!;
    expect(staged.months).toBeGreaterThan(atOnce.months);
  });

  it("keep-2 returns an IRR and carries retained equity to terminal", () => {
    const r = runOption(deal, a, opt("C"));
    const t = timeline(deal, a, r, sellMonthsFor("atonce", r.soldN))!;
    expect(t.irr).not.toBeNull();
    expect(t.points.length).toBe(t.months + 1);
  });
});
