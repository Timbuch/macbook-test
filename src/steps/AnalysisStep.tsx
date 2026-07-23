import { useMemo, useState } from "react";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import type { Assumptions, Deal, Result } from "../engine";
import { benchmark, equityToday, runOption } from "../engine";
import type { BenchmarkType } from "../defaults";
import { BENCHMARKS, optionSet } from "../defaults";
import type { TaxInputs, TaxResult } from "../tax";
import { applyTax } from "../tax";
import { fmt, fmtM, pct } from "../format";

ChartJS.register(
  LineController, BarController, LineElement, BarElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend,
);

const PALETTE: Record<string, string> = { A: "#48773C", B: "#ABC6CA", C: "#3D3935", D: "#8FA96B" };

interface Props {
  deal: Deal;
  assumptions: Assumptions;
  tax: TaxInputs;
  gstOk: boolean;
  benchmarkType: BenchmarkType;
  keepN: number;
  selected: Record<string, boolean>;
  onBack: () => void;
}

export function AnalysisStep({ deal, assumptions: a, tax, gstOk, benchmarkType, keepN, selected, onBack }: Props) {
  const results = useMemo<Result[]>(
    () => optionSet(keepN).filter((o) => selected[o.key]).map((o) => runOption(deal, a, o)),
    [deal, a, keepN, selected],
  );
  const taxByKey = useMemo<Record<string, TaxResult>>(() => {
    const m: Record<string, TaxResult> = {};
    for (const r of results) m[r.key] = applyTax(deal, a, r, tax);
    return m;
  }, [results, deal, a, tax]);
  const [wfIdx, setWfIdx] = useState(0);
  const [afterTax, setAfterTax] = useState(false);

  if (!results.length) {
    return (
      <>
        <h2 className="sc-title">Capital analysis</h2>
        <div className="placeholder">Pick at least one strategy on the previous step.</div>
        <div className="actions"><button className="btn ghost" onClick={onBack}>← Back to options</button></div>
      </>
    );
  }

  const eq0 = equityToday(deal, a);
  const bench = eq0 * Math.pow(1 + a.hurdle, a.horizon);
  const benchRoi = Math.pow(1 + a.hurdle, a.horizon) - 1; // ROI of the next best option over the horizon
  const benchName = benchmarkType === "mortgage" ? BENCHMARKS.mortgage.short : BENCHMARKS[benchmarkType].short;
  const showAfterTax = afterTax && gstOk;

  // Switch the headline metrics between pre-tax and after-tax. `roi` = total
  // return over the horizon on the equity you have today (comparable to the
  // next best option, which grows that same equity at its rate).
  const M = (r: Result) => {
    const t = taxByKey[r.key];
    const base = showAfterTax
      ? { nw10: t.afterTaxNw10, cagr: t.afterTaxCagr, freshCash: t.afterTaxFreshCash, net1: t.afterTaxNet1, wealth: t.afterTaxWealth }
      : { nw10: r.nw10, cagr: r.cagr, freshCash: r.freshCash, net1: r.net1, wealth: r.wealth };
    return { ...base, roi: eq0 > 0 ? (base.nw10 - eq0) / eq0 : 0 };
  };

  const bestWealth = [...results].sort((x, y) => M(y).nw10 - M(x).nw10)[0];
  const leanest = [...results].sort(
    (x, y) => M(x).freshCash + x.equityLocked - (M(y).freshCash + y.equityLocked),
  )[0];
  const icrBind = results.some((r) => r.binding === "ICR");
  const wf = results[Math.min(wfIdx, results.length - 1)];
  const mBest = M(bestWealth);

  return (
    <>
      <h2 className="sc-title">Capital analysis</h2>
      <p className="sc-sub">
        How much cash each path ties up, whether the rentals service the debt at today&rsquo;s rates,
        and how wealth grows over {a.horizon} years against the next best use of the money.
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18 }}>
        <div className="wftabs" style={{ margin: 0 }}>
          <button className={!showAfterTax ? "on" : ""} onClick={() => setAfterTax(false)}>Pre-tax</button>
          <button
            className={showAfterTax ? "on" : ""}
            onClick={() => setAfterTax(true)}
            disabled={!gstOk}
            title={gstOk ? "" : "Confirm the GST answers on the options step first"}
            style={gstOk ? undefined : { opacity: 0.5, cursor: "not-allowed" }}
          >
            After GST &amp; income tax
          </button>
        </div>
        <small>
          {showAfterTax
            ? "Showing indicative after-tax figures."
            : afterTax && !gstOk
              ? "Confirm the GST answers on the options step to see after-tax figures."
              : "Showing pre-tax figures."}
        </small>
      </div>

      {/* recommendation */}
      <div className="reco">
        <span className="tag">Read on the numbers</span>
        <br />
        Equity today is about <b>{fmtM(eq0)}</b> (the ~{fmtM(deal.asIsValue)} land less the {fmtM(a.mortgage)} mortgage).
        In {benchName} at {pct(a.hurdle)} it would grow to <b>{fmtM(bench)}</b> over {a.horizon} years ({pct(benchRoi)} ROI) —
        that&rsquo;s where the money goes if not in the project.{" "}
        <b>{bestWealth.name}</b> builds the most wealth ({fmtM(mBest.nw10)}, {pct(mBest.roi)} ROI) but ties up{" "}
        <b>{fmtM(mBest.freshCash + bestWealth.equityLocked)}</b> of cash
        {bestWealth.cashYield ? ` at a ${pct(bestWealth.cashYield)} cash yield` : ""}.{" "}
        <b>{leanest.name}</b> keeps the owner most liquid.
        {icrBind && (
          <>
            {" "}
            Keeping rentals is <b>ICR-limited</b> — at today&rsquo;s rents the bank lends less than the LVR allows,
            so more of the owner&rsquo;s own cash stays in.
          </>
        )}
      </div>

      {/* KPI row */}
      <div className="grid4" style={{ marginTop: 18 }}>
        <Kpi l="Fresh cash needed" v={fmt(mBest.freshCash)} s={bestWealth.name} />
        <Kpi
          l="Equity locked up"
          v={fmt(bestWealth.equityLocked)}
          s={bestWealth.cashYield ? pct(bestWealth.cashYield) + " cash yield" : "liquid"}
        />
        <Kpi l={`Net wealth · yr ${a.horizon}`} v={fmtM(mBest.nw10)} s={pct(mBest.cagr) + " p.a."} />
        <Kpi l={`Return · ${a.horizon}-yr ROI`} v={pct(mBest.roi)} s={`vs ${pct(benchRoi)} in ${benchName}`} />
      </div>

      {/* charts */}
      <div className="grid2" style={{ marginTop: 18 }}>
        <div className="card">
          <h3>10-year net wealth</h3>
          <p className="note">Net worth from the project each year vs the dashed line — the same cash in your next best option.</p>
          <div className="chartbox" style={{ marginTop: 10 }}>
            <WealthChart results={results} deal={deal} a={a} wealthOf={(r) => M(r).wealth} />
          </div>
          <div className="legend">
            {results.map((r) => (
              <span key={r.key}>
                <i style={{ background: PALETTE[r.key] }} />
                {r.name}
              </span>
            ))}
            <span>
              <i className="dash" />
              Next best — {benchName} ({pct(a.hurdle)})
            </span>
          </div>
        </div>

        <div className="card">
          <h3>Cash committed vs yield</h3>
          <p className="note">Fresh cash in plus equity locked up (bars), with the year-1 cash yield overlaid.</p>
          <div className="chartbox" style={{ marginTop: 10 }}>
            <CashChart results={results} />
          </div>
        </div>
      </div>

      {/* serviceability / ICR */}
      <div className="card">
        <h3>Serviceability &amp; ICR at today&rsquo;s rates</h3>
        <table style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Strategy</th>
              <th className="num">Homes</th>
              <th className="num">Net rent (NOI)</th>
              <th className="num">Max debt</th>
              <th>Binding</th>
              <th className="num">ICR</th>
              <th className="num">Cashflow / yr</th>
              <th>Self-funding?</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              if (r.heldN === 0) {
                return (
                  <tr key={r.key}>
                    <td><b>{r.name}</b></td>
                    <td className="num">0</td>
                    <td className="num">—</td>
                    <td className="num">—</td>
                    <td>—</td>
                    <td className="num">—</td>
                    <td className="num">—</td>
                    <td><span className="badge ok">no debt held</span></td>
                  </tr>
                );
              }
              const cf = r.netRent1;
              return (
                <tr key={r.key}>
                  <td><b>{r.name}</b></td>
                  <td className="num">{r.heldN}</td>
                  <td className="num">{fmt(r.NOI1)}</td>
                  <td className="num">{fmt(r.heldDebt)}</td>
                  <td>
                    <span className={"badge " + (r.binding === "ICR" ? "icr" : "ok")}>
                      {r.binding === "ICR" ? "ICR (serviceability)" : "LVR"}
                    </span>
                  </td>
                  <td className="num">{r.icr!.toFixed(2)}×</td>
                  <td className="num" style={{ color: cf < 0 ? "var(--red)" : "var(--moss)", fontWeight: 700 }}>
                    {fmt(cf)}
                    {cf < 0 ? "/yr top-up" : "/yr"}
                  </td>
                  <td>
                    {cf < 0 ? (
                      <span className="badge warn">needs top-up</span>
                    ) : (
                      <span className="badge ok">self-funding</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* waterfall */}
      <div className="card">
        <h3>Money in, money out at completion</h3>
        <div className="wftabs" style={{ marginTop: 10 }}>
          {results.map((r, i) => (
            <button key={r.key} className={i === wfIdx ? "on" : ""} onClick={() => setWfIdx(i)}>
              {r.name}
            </button>
          ))}
        </div>
        <table>
          <tbody>
            {wf.items.map((it, i) => (
              <tr key={i}>
                <td>{it[0]}</td>
                <td className={"num " + it[2]}>{fmt(it[1])}</td>
              </tr>
            ))}
            <tr className="total">
              <td>{wf.net1 >= 0 ? "Surplus cash at completion" : "Fresh cash the owner must inject"}</td>
              <td className="num">{fmt(wf.net1)}</td>
            </tr>
          </tbody>
        </table>
        {wf.heldN > 0 ? (
          <div className="callout water">
            <b>Revalue &amp; refinance</b> — the {wf.heldN} kept homes are worth {fmt(wf.heldN * a.homeVal)}. The bank lends
            the lower of {pct(a.refiLVR)} LVR and what the rent services at the {pct(a.testRate)} test rate — here{" "}
            <b>{wf.binding === "ICR" ? "serviceability (ICR) binds" : "LVR binds"}</b>, capping debt at {fmt(wf.heldDebt)}.
            So <b>{fmt(wf.equityLocked)}</b> of equity stays in the rentals at a{" "}
            {wf.cashYield ? pct(wf.cashYield) : "—"} year-one cash yield.{" "}
            {wf.netRent1 < 0
              ? `It runs ${fmt(-wf.netRent1)}/yr negative at today's funding rate — a real top-up.`
              : "Rent covers the interest, so it's self-funding."}
          </div>
        ) : (
          <div className="callout moss">
            <b>Fully liquid</b> — mortgage repaid, nothing retained. The owner nets {fmt(wf.net1)} and can redeploy it
            (modelled growing at the {pct(a.hurdle)} next-best return).
          </div>
        )}
      </div>

      {/* comparison */}
      <div className="card">
        <h3>Side by side</h3>
        <table style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Strategy</th>
              <th className="num">Fresh cash</th>
              <th className="num">Equity locked</th>
              <th className="num">Yr-1 yield</th>
              <th className="num">Net wealth yr {a.horizon}</th>
              <th className="num">CAGR</th>
              <th className="num">{a.horizon}-yr ROI</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const m = M(r);
              return (
                <tr key={r.key}>
                  <td><b>{r.name}</b></td>
                  <td className="num">{fmt(m.freshCash)}</td>
                  <td className="num">{fmt(r.equityLocked)}</td>
                  <td className="num">{r.cashYield ? pct(r.cashYield) : "—"}</td>
                  <td className="num">{fmtM(m.nw10)}</td>
                  <td className="num">{pct(m.cagr)}</td>
                  <td className="num" style={{ color: m.roi >= benchRoi ? "var(--moss)" : "var(--red)", fontWeight: 700 }}>
                    {pct(m.roi)}
                  </td>
                </tr>
              );
            })}
            <tr style={{ background: "var(--sand-tint)" }}>
              <td><b>Next best: {benchName}</b><br /><small>where the cash goes if not in the project</small></td>
              <td className="num">—</td>
              <td className="num">—</td>
              <td className="num">—</td>
              <td className="num">{fmtM(bench)}</td>
              <td className="num">{pct(a.hurdle)}</td>
              <td className="num" style={{ fontWeight: 700 }}>{pct(benchRoi)}</td>
            </tr>
          </tbody>
        </table>
        <small>{showAfterTax ? "After GST & income tax." : "Pre-tax."} ROI = total return over {a.horizon} years on today&rsquo;s equity.</small>
      </div>

      {/* tax & GST */}
      <div className="card">
        <h3>GST &amp; income tax</h3>
        <p className="note">Indicative NZ treatment from your Tax &amp; GST intake. Confirm with a tax adviser.</p>
        <table style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Strategy</th>
              <th className="num">Dev profit tax</th>
              <th className="num">Rental tax (yr 1)</th>
              <th className="num">GST effect</th>
              <th className="num">After-tax completion cash</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const t = taxByKey[r.key];
              return (
                <tr key={r.key}>
                  <td><b>{r.name}</b></td>
                  <td className="num">{fmt(-t.incomeTaxDev)}</td>
                  <td className="num">{r.heldN > 0 ? fmt(-t.incomeTaxRentalYr1) : "—"}</td>
                  <td className="num" style={{ color: t.gst.net >= 0 ? "var(--moss)" : "var(--red)" }}>{fmt(t.gst.net)}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{fmt(t.afterTaxNet1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {taxByKey[wf.key]?.gst.warning && (
          <div className="callout" style={{ background: "#fdf0e6", borderLeft: "3px solid var(--amber)" }}>
            <b>GST flag:</b> {taxByKey[wf.key].gst.warning}
          </div>
        )}
        <ul style={{ margin: "12px 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--muted)" }}>
          {(taxByKey[wf.key]?.notes ?? []).map((n, i) => (
            <li key={i} style={{ marginBottom: 3 }}>{n}</li>
          ))}
        </ul>
      </div>

      <div className="actions">
        <button className="btn ghost" onClick={onBack}>← Adjust options</button>
        <button className="btn sec" onClick={() => alert("Export coming soon: branded McK feasibility + capital-strategy PDF and the Excel model.")}>
          Export report
        </button>
      </div>
    </>
  );
}

function Kpi({ l, v, s }: { l: string; v: string; s: string }) {
  return (
    <div className="kpi">
      <div className="l">{l}</div>
      <div className="v">{v}</div>
      <div className="s">{s}</div>
    </div>
  );
}

function WealthChart({
  results,
  deal,
  a,
  wealthOf,
}: {
  results: Result[];
  deal: Deal;
  a: Assumptions;
  wealthOf: (r: Result) => number[];
}) {
  const labels = Array.from({ length: a.horizon + 1 }, (_, t) => "Yr " + t);
  const datasets = results.map((r) => ({
    label: r.name,
    data: wealthOf(r),
    borderColor: PALETTE[r.key] ?? "#48773C",
    backgroundColor: "transparent",
    tension: 0.2,
    borderWidth: 2.5,
    pointRadius: 0,
  }));
  datasets.push({
    label: "Next best",
    data: benchmark(deal, a),
    borderColor: "#7c7770",
    backgroundColor: "transparent",
    // @ts-expect-error chart.js accepts borderDash at runtime
    borderDash: [6, 4],
    borderWidth: 2,
    pointRadius: 0,
    tension: 0,
  });
  return (
    <Chart
      type="line"
      data={{ labels, datasets }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { ticks: { callback: (v) => "$" + (Number(v) / 1e6).toFixed(0) + "M" } } },
      }}
    />
  );
}

function CashChart({ results }: { results: Result[] }) {
  return (
    <Chart
      type="bar"
      data={{
        labels: results.map((r) => r.name),
        datasets: [
          {
            type: "bar" as const,
            label: "Equity locked up",
            data: results.map((r) => Math.round(r.equityLocked)),
            backgroundColor: "#48773C",
            yAxisID: "y",
            order: 2,
          },
          {
            type: "bar" as const,
            label: "Fresh cash in",
            data: results.map((r) => Math.round(r.freshCash)),
            backgroundColor: "#ABC6CA",
            yAxisID: "y",
            order: 2,
          },
          {
            type: "line" as const,
            label: "Yr-1 cash yield",
            data: results.map((r) => (r.cashYield ? +(r.cashYield * 100).toFixed(1) : 0)),
            borderColor: "#3D3935",
            backgroundColor: "#3D3935",
            yAxisID: "y1",
            order: 1,
            tension: 0,
            pointRadius: 5,
            showLine: false,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } },
        scales: {
          y: { stacked: true, ticks: { callback: (v) => "$" + (Number(v) / 1e6).toFixed(1) + "M" } },
          y1: {
            position: "right",
            grid: { drawOnChartArea: false },
            ticks: { callback: (v) => v + "%" },
            title: { display: true, text: "cash yield" },
          },
        },
      }}
    />
  );
}
