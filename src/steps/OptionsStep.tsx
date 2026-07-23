import type { Assumptions, Deal } from "../engine";
import { optionSet } from "../defaults";

interface Props {
  deal: Deal;
  assumptions: Assumptions;
  patch: (p: Partial<Assumptions>) => void;
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
};

export function OptionsStep(props: Props) {
  const { deal, assumptions, patch, keepN, setKeepN, selected, setSelected, onNext } = props;
  const options = optionSet(keepN);
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

      <div className="card">
        <h3>Opportunity cost</h3>
        <p className="note">The next best use of the cash — the bar every strategy has to clear.</p>
        <div className="inline" style={{ maxWidth: 420, marginTop: 8 }}>
          <Pct label="Hurdle / next-best return" v={assumptions.hurdle} on={(n) => patch({ hurdle: n })} />
          <Num label="Horizon (years)" v={assumptions.horizon} on={(n) => patch({ horizon: n })} />
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
