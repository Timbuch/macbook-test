/**
 * Verifies the engine against the worked example in
 * docs/GROUNDWORK-BUILD-SPEC.md §9. If these pass, the port is faithful to the
 * reference prototype and the math is correct — build UI on top with confidence.
 *
 * Equity today = $950,000 (as-is $2.45M net − $1.5M mortgage).
 * Benchmark at 10% → $2,464,055 over 10 years.
 */
import { describe, expect, it } from "vitest";
import { benchmark, equityToday, projectReturn, runOption } from "./engine";
import { CLEVEDON_DEAL, DEFAULT_ASSUMPTIONS, optionSet } from "./defaults";

const deal = CLEVEDON_DEAL;
const a = DEFAULT_ASSUMPTIONS;

/** Round to nearest dollar to compare against the spec's tabulated integers. */
const round = (n: number) => Math.round(n);
/** Percentage to one decimal place, matching the spec table (e.g. 18.4%). */
const pct1 = (n: number) => +(n * 100).toFixed(1);
/** Assert x within tol of y (default $1). */
const near = (x: number | null, y: number, tol = 1) => expect(Math.abs((x ?? NaN) - y)).toBeLessThanOrEqual(tol);

const byKey = (keepN = 2) => {
  const map: Record<string, ReturnType<typeof runOption>> = {};
  for (const cfg of optionSet(keepN)) map[cfg.key] = runOption(deal, a, cfg);
  return map;
};

describe("baseline position", () => {
  it("equity today is $950,000", () => {
    expect(round(equityToday(deal, a))).toBe(950_000);
  });
  it("benchmark reaches $2,464,055 at 10 years", () => {
    const b = benchmark(deal, a);
    expect(b.length).toBe(a.horizon + 1);
    expect(round(b[a.horizon])).toBe(2_464_055);
  });
});

// §9 table — each row is [freshCash, equityLocked, yr1CashYield%, net1, nw10, cagr%, binding]
describe("§9 worked example", () => {
  it("A · Sell all 8", () => {
    const r = byKey().A;
    expect(r.heldDebt).toBe(0);
    expect(r.binding).toBe("—");
    expect(round(r.freshCash)).toBe(0);
    expect(round(r.equityLocked)).toBe(0);
    expect(r.cashYield).toBeNull();
    expect(round(r.net1)).toBe(2_176_527);
    expect(round(r.nw10)).toBe(5_132_137);
    expect(pct1(r.cagr)).toBe(18.4);
  });

  it("B · Sell in one line", () => {
    const r = byKey().B;
    expect(r.heldDebt).toBe(0);
    expect(round(r.net1)).toBe(1_380_717);
    expect(round(r.nw10)).toBe(3_255_658);
    expect(pct1(r.cagr)).toBe(13.1);
  });

  it("C · Keep 2 — ICR-bound", () => {
    const r = byKey(2).C;
    expect(round(r.heldDebt)).toBe(686_971);
    expect(r.binding).toBe("ICR");
    expect(round(r.freshCash)).toBe(0);
    expect(round(r.equityLocked)).toBe(2_013_029);
    expect(pct1(r.cashYield!)).toBe(1.0);
    expect(round(r.net1)).toBe(801_525);
    expect(round(r.nw10)).toBe(5_413_901);
    expect(pct1(r.cagr)).toBe(19.0);
  });

  it("C · Keep 4 — needs fresh cash", () => {
    const r = byKey(4).C;
    expect(round(r.heldDebt)).toBe(1_373_941);
    expect(r.binding).toBe("ICR");
    expect(round(r.freshCash)).toBe(573_477);
    expect(round(r.equityLocked)).toBe(4_026_059);
    expect(round(r.net1)).toBe(-573_477);
    expect(round(r.nw10)).toBe(5_695_664);
    expect(pct1(r.cagr)).toBe(19.6);
  });

  it("D · Keep all 8", () => {
    const r = byKey().D;
    expect(round(r.heldDebt)).toBe(2_747_882);
    expect(r.binding).toBe("ICR");
    expect(round(r.freshCash)).toBe(3_323_480);
    expect(round(r.equityLocked)).toBe(8_052_118);
    expect(round(r.net1)).toBe(-3_323_480);
    expect(round(r.nw10)).toBe(6_259_191);
    expect(pct1(r.cagr)).toBe(20.7);
  });

  it("every development option beats the 10% hurdle", () => {
    const rs = Object.values(byKey()).filter((r) => !r.holdAsIs);
    for (const r of rs) expect(r.beats).toBeGreaterThan(0);
  });
});

describe("hold-as-is option", () => {
  const E = runOption(deal, a, optionSet().find((o) => o.key === "E")!);
  it("no development: raw site appreciates at capG, net of mortgage", () => {
    expect(E.holdAsIs).toBe(true);
    expect(E.heldDebt).toBe(0);
    expect(E.net1).toBe(0);
    // yr10 = asIsValue × (1+capG)^10 − mortgage
    expect(round(E.nw10)).toBe(round(deal.asIsValue * Math.pow(1 + a.capG, a.horizon) - a.mortgage));
    expect(E.wealth[0]).toBe(round(equityToday(deal, a))); // starts at equity today (integer here)
  });
  it("has no development margin", () => {
    const p = projectReturn(deal, a, E);
    expect(p.profit).toBe(0);
    expect(p.cashOnCash).toBeNull();
  });
});

describe("project return (development margin)", () => {
  it("A · Sell all 8 — margin and cash-on-cash", () => {
    const p = projectReturn(deal, a, byKey().A);
    near(p.profit, 1_176_527);
    near(p.marginOnCost, 0.3417, 0.001);
    near(p.cashOnCash, 1.1765, 0.001); // leveraged: profit ÷ $1.0M land equity
  });
});
