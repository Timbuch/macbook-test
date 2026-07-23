/** Verifies the GST + income-tax overlay (tax.ts). The pre-tax engine is checked
 *  separately in engine.test.ts; here we confirm the tax adjustments. */
import { describe, expect, it } from "vitest";
import { runOption } from "./engine";
import { CLEVEDON_DEAL, DEFAULT_ASSUMPTIONS, optionSet } from "./defaults";
import { DEFAULT_TAX, applyTax, type TaxInputs } from "./tax";

const deal = CLEVEDON_DEAL;
const a = DEFAULT_ASSUMPTIONS;
const near = (x: number, y: number, tol = 1) => expect(Math.abs(x - y)).toBeLessThanOrEqual(tol);

const A = runOption(deal, a, optionSet(2).find((o) => o.key === "A")!);
const C2 = runOption(deal, a, optionSet(2).find((o) => o.key === "C")!);
const registered: TaxInputs = { ...DEFAULT_TAX, gstRegistered: true };

describe("income tax on development profit", () => {
  it("A · Sell all 8 — taxable profit and tax at 28%", () => {
    const t = applyTax(deal, a, A, DEFAULT_TAX);
    near(t.devTaxableProfit, 1_776_527); // sectionNet − land − civil − dev interest
    near(t.incomeTaxDev, 497_428);
  });
  it("after-tax completion cash = pre-tax net1 − dev tax + GST effect", () => {
    const t = applyTax(deal, a, A, registered);
    near(t.afterTaxNet1, A.net1 - t.incomeTaxDev + t.gst.net);
  });
});

describe("GST position", () => {
  it("registered + exempt rentals: unrecoverable GST on retained build", () => {
    const t = applyTax(deal, a, C2, registered);
    near(t.gst.heldBuildGstCost, 130_500); // 2 × $435k build × 15%
    near(t.gst.net, -130_500);
    expect(t.gst.registered).toBe(true);
  });
  it("not registered: warns about compulsory registration", () => {
    const t = applyTax(deal, a, A, DEFAULT_TAX);
    expect(t.gst.registered).toBe(false);
    expect(t.gst.warning).toMatch(/compulsory/i);
    expect(t.notes.length).toBeGreaterThan(0);
  });
});

describe("after-tax wealth", () => {
  it("tax reduces net worth vs pre-tax (registered case)", () => {
    const t = applyTax(deal, a, C2, registered);
    expect(t.afterTaxNw10).toBeLessThan(C2.nw10);
    expect(t.afterTaxWealth.length).toBe(a.horizon + 1);
    expect(t.afterTaxWealth[0]).toBe(C2.eq0); // starts at equity today
  });
  it("no rental tax when nothing is held (Sell all)", () => {
    const t = applyTax(deal, a, A, registered);
    expect(t.incomeTaxRentalYr1).toBe(0);
  });
});
