import type { Assumptions, Deal } from "../engine";
import type { BenchmarkType, SalesChannel, SellDown, WhoBuilds } from "../defaults";
import { BENCHMARKS, optionSet } from "../defaults";
import type { TaxIntake } from "../tax";
import { gstAnswered } from "../tax";
import type { Intake } from "../App";

interface Props {
  deal: Deal;
  assumptions: Assumptions;
  patch: (p: Partial<Assumptions>) => void;
  taxIntake: TaxIntake;
  patchTax: (p: Partial<TaxIntake>) => void;
  benchmarkType: BenchmarkType;
  setBenchmark: (t: BenchmarkType) => void;
  intake: Intake;
  patchIntake: (p: Partial<Intake>) => void;
  keepN: number;
  setKeepN: (n: number) => void;
  selected: Record<string, boolean>;
  setSelected: (s: Record<string, boolean>) => void;
  onNext: () => void;
}

const OPTION_BLURB: Record<string, string> = {
  A: "Subdivide and sell all sections. Fully liquid, mortgage repaid.",
  B: "Sell the whole site in one line as a fallback — faster, lower price.",
  C: "Sell most, build & keep some as long-term rentals.",
  D: "Build and keep every home. Maximum hold, maximum cash tied up.",
  E: "Don't develop — hold the raw site for the horizon, appreciating with the property market.",
};

export function OptionsStep(props: Props) {
  const { deal, assumptions, patch, taxIntake, patchTax, benchmarkType, setBenchmark, intake, patchIntake, keepN, setKeepN, selected, setSelected, onNext } =
    props;
  const options = optionSet(keepN);
  const gstDone = gstAnswered(taxIntake);
  const toggle = (k: string) => setSelected({ ...selected, [k]: !selected[k] });

  return (
    <>
      <h2 className="sc-title">Options &amp; finance</h2>
      <p className="sc-sub">
        Pick the strategies to compare, then tune any assumption. Everything recomputes on the next step.
        Defaults are the Clevedon deal at July-2026 NZ finance settings.
      </p>

      <div className="card">
        <h3>Strategies to compare</h3>
        <p className="note">Choose one or more. Keep-count for option C is set below.</p>
        <div className="scns" style={{ marginTop: 14 }}>
          {options.map((o) => (
            <div key={o.key} className={"scn" + (selected[o.key] ? " on" : "")} onClick={() => toggle(o.key)}>
              <div className="k">
                <h4>
                  {o.key} · {o.name}
                </h4>
                <span className="tick">{selected[o.key] ? "✓" : ""}</span>
              </div>
              <p>{OPTION_BLURB[o.key]}</p>
            </div>
          ))}
        </div>
        <div className="field" style={{ marginTop: 16, maxWidth: 260 }}>
          <label>Homes to build &amp; keep (option C)</label>
          <input
            type="number"
            min={1}
            max={deal.lots - 1}
            value={keepN}
            onChange={(e) => setKeepN(Math.max(1, Math.min(deal.lots - 1, +e.target.value || 1)))}
          />
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Existing position</h3>
          <Money label="Current mortgage on the land" v={assumptions.mortgage} on={(n) => patch({ mortgage: n })} />
          <Pct label="Mortgage rate" v={assumptions.mortgageRate} on={(n) => patch({ mortgageRate: n })} />
          <Money label="Cost basis in the land" v={assumptions.basis} on={(n) => patch({ basis: n })} />
        </div>

        <div className="card">
          <h3>Development funding</h3>
          <div className="field">
            <label>Fund civil &amp; build with</label>
            <select value={assumptions.devFund} onChange={(e) => patch({ devFund: e.target.value as "debt" | "cash" })}>
              <option value="debt">Development loan</option>
              <option value="cash">Cash</option>
            </select>
          </div>
          <div className="inline">
            <Pct label="Development finance rate" v={assumptions.devRate} on={(n) => patch({ devRate: n })} />
            <Num label="Dev / build period (months)" v={assumptions.devMonths} on={(n) => patch({ devMonths: n })} />
          </div>
        </div>

        <div className="card">
          <h3>Serviceability — today</h3>
          <div className="inline">
            <Pct label="Actual funding rate" v={assumptions.intRate} on={(n) => patch({ intRate: n })} />
            <Pct label="Bank servicing test rate" v={assumptions.testRate} on={(n) => patch({ testRate: n })} />
          </div>
          <div className="inline">
            <Num label="Required ICR (×)" step={0.05} v={assumptions.reqICR} on={(n) => patch({ reqICR: n })} />
            <Pct label="Refinance LVR (held homes)" v={assumptions.refiLVR} on={(n) => patch({ refiLVR: n })} />
          </div>
          <p className="note" style={{ marginTop: 6 }}>
            Debt on retained homes = min(LVR, ICR). On low-yield rentals the ICR limb usually binds.
          </p>
        </div>

        <div className="card">
          <h3>Build &amp; rental</h3>
          <div className="inline">
            <Money label="Build cost / home" v={assumptions.build} on={(n) => patch({ build: n })} />
            <Money label="Completed value / home" v={assumptions.homeVal} on={(n) => patch({ homeVal: n })} />
          </div>
          <div className="inline">
            <Money label="Rent / home / week" v={assumptions.rentWk} on={(n) => patch({ rentWk: n })} />
            <Pct label="Operating costs (% of rent)" v={assumptions.opex} on={(n) => patch({ opex: n })} />
          </div>
          <div className="inline">
            <Pct label="Vacancy" v={assumptions.vacancy} on={(n) => patch({ vacancy: n })} />
            <Pct label="Rent growth p.a." v={assumptions.rentG} on={(n) => patch({ rentG: n })} />
          </div>
          <Pct label="Capital growth p.a." v={assumptions.capG} on={(n) => patch({ capG: n })} />
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Sale &amp; delivery</h3>
          <p className="note">Who sells and builds, and how the site sells down.</p>
          <div className="field" style={{ marginTop: 10 }}>
            <label>Who sells the sections</label>
            <select value={intake.salesChannel} onChange={(e) => patchIntake({ salesChannel: e.target.value as SalesChannel })}>
              <option value="agent">Licensed real estate agent (2.75%)</option>
              <option value="private">Private sale — no agent (0%)</option>
              <option value="tender">Tender / deadline sale (2.75% + marketing)</option>
              <option value="inhouse">Developer&rsquo;s in-house team (1%)</option>
            </select>
          </div>
          <div className="field">
            <label>Sell-down</label>
            <select value={intake.sellDown} onChange={(e) => patchIntake({ sellDown: e.target.value as SellDown })}>
              <option value="atonce">All at once on completion</option>
              <option value="staged">Staged (~1 section / 1.5 months)</option>
              <option value="bulk">Bulk / one line</option>
            </select>
          </div>
          <div className="field">
            <label>Who builds</label>
            <select value={intake.whoBuilds} onChange={(e) => patchIntake({ whoBuilds: e.target.value as WhoBuilds })}>
              <option value="contractor">Main contractor (fixed price)</option>
              <option value="developer">Developer project-manages</option>
              <option value="unsure">Not sure yet</option>
            </select>
          </div>
          {intake.sellDown === "staged" && (
            <p className="note" style={{ color: "var(--amber)" }}>
              Staged sell-down holding costs aren&rsquo;t modelled yet — treated as completion for now.
            </p>
          )}
        </div>

        <div className="card" style={{ borderColor: gstDone ? undefined : "var(--amber)" }}>
          <h3>Tax &amp; GST</h3>
          <p className="note">
            GST treatment is <b>specific to each project</b> — it isn&rsquo;t carried over, so confirm it below every time.
          </p>
          <div className="field" style={{ marginTop: 10 }}>
            <label>Income tax rate / entity</label>
            <select value={taxIntake.incomeTaxRate} onChange={(e) => patchTax({ incomeTaxRate: +e.target.value })}>
              <option value={0.28}>Company — 28%</option>
              <option value={0.33}>Trust — 33%</option>
              <option value={0.39}>Top personal — 39%</option>
            </select>
          </div>
          <div className="field">
            <label>GST registration for the development</label>
            <select value={taxIntake.gstRegistered} onChange={(e) => patchTax({ gstRegistered: e.target.value as TaxIntake["gstRegistered"] })}>
              <option value="">— confirm for this project —</option>
              <option value="yes">Registered (or will register)</option>
              <option value="no">Not registered</option>
            </select>
          </div>
          <div className="field">
            <label>GST when the land was purchased</label>
            <select value={taxIntake.purchaseGst} onChange={(e) => patchTax({ purchaseGst: e.target.value as TaxIntake["purchaseGst"] })}>
              <option value="">— confirm for this project —</option>
              <option value="zero-rated">Zero-rated (going concern)</option>
              <option value="claimed">Claimed GST on purchase</option>
              <option value="second-hand">Second-hand goods credit</option>
              <option value="none">No GST / bought privately</option>
            </select>
          </div>
          <div className="field">
            <label>Retained rental homes — GST</label>
            <select value={taxIntake.heldGst} onChange={(e) => patchTax({ heldGst: e.target.value as TaxIntake["heldGst"] })}>
              <option value="">— confirm for this project —</option>
              <option value="exempt">Exempt — no GST claim on their build</option>
              <option value="change-of-use">Claim, then change-of-use adjustment</option>
            </select>
          </div>
          {!gstDone && (
            <p className="note" style={{ color: "var(--amber)" }}>
              Confirm all three GST answers to unlock the after-tax view.
            </p>
          )}
          {taxIntake.gstRegistered === "no" && (
            <p className="note" style={{ color: "var(--amber)" }}>
              Selling multiple sections is normally a taxable activity — GST registration is usually compulsory at this scale.
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Your next best option</h3>
        <p className="note">
          If you freed up the cash, where would it go? Groundwork grows it at that return and compares every strategy
          against it — so a strategy is only worth it if it beats parking the money there. (Holding the raw site is its own
          option above.)
        </p>
        <div className="grid2" style={{ marginTop: 10 }}>
          <div className="field">
            <label>Next best use of the money</label>
            <select value={benchmarkType} onChange={(e) => setBenchmark(e.target.value as BenchmarkType)}>
              <option value="fund">{BENCHMARKS.fund.label} (~10%)</option>
              <option value="mortgage">{BENCHMARKS.mortgage.label} ({(assumptions.mortgageRate * 100).toFixed(1)}%)</option>
              <option value="termdeposit">{BENCHMARKS.termdeposit.label} (~4%)</option>
              <option value="custom">{BENCHMARKS.custom.label}</option>
            </select>
            <p className="note" style={{ marginTop: 4 }}>{BENCHMARKS[benchmarkType].blurb}</p>
          </div>
          <div className="inline">
            <Pct label="Return it would earn" v={assumptions.hurdle} on={(n) => patch({ hurdle: n })} />
            <Num label="Horizon (years)" v={assumptions.horizon} on={(n) => patch({ horizon: n })} />
          </div>
        </div>
      </div>

      <div className="actions">
        <button className="btn" onClick={onNext}>
          Run capital analysis →
        </button>
      </div>
    </>
  );
}

// ── field primitives (rates stored as fractions, shown as %) ──

function Money({ label, v, on }: { label: string; v: number; on: (n: number) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="number"
        value={v}
        step={1000}
        onChange={(e) => on(+e.target.value || 0)}
      />
    </div>
  );
}

function Pct({ label, v, on }: { label: string; v: number; on: (n: number) => void }) {
  return (
    <div className="field">
      <label>{label} (%)</label>
      <input
        type="number"
        value={+(v * 100).toFixed(2)}
        step={0.05}
        onChange={(e) => on((+e.target.value || 0) / 100)}
      />
    </div>
  );
}

function Num({
  label,
  v,
  on,
  step = 1,
}: {
  label: string;
  v: number;
  on: (n: number) => void;
  step?: number;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type="number" value={v} step={step} onChange={(e) => on(+e.target.value || 0)} />
    </div>
  );
}
