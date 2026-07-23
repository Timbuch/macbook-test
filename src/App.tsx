import { useMemo, useState } from "react";
import type { Assumptions, Deal } from "./engine";
import type { BenchmarkType, SalesChannel, SellDown, WhoBuilds } from "./defaults";
import { BENCHMARKS, CLEVEDON_DEAL, DEFAULT_ASSUMPTIONS, withSalesChannel } from "./defaults";
import type { TaxIntake } from "./tax";
import { DEFAULT_TAX_INTAKE, gstAnswered, resolveTax } from "./tax";
import { UploadStep } from "./steps/UploadStep";
import { OptionsStep } from "./steps/OptionsStep";
import { AnalysisStep } from "./steps/AnalysisStep";

const STEPS = ["Upload", "Confirm & explore", "Options & finance", "Capital analysis"];

export interface Intake {
  salesChannel: SalesChannel;
  sellDown: SellDown;
  whoBuilds: WhoBuilds;
}

export function App() {
  const [step, setStep] = useState(0);
  const [deal, setDeal] = useState<Deal>(CLEVEDON_DEAL);
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [taxIntake, setTaxIntake] = useState<TaxIntake>(DEFAULT_TAX_INTAKE);
  const [benchmarkType, setBenchmarkType] = useState<BenchmarkType>("fund");
  const [intake, setIntake] = useState<Intake>({ salesChannel: "private", sellDown: "atonce", whoBuilds: "contractor" });
  const [keepN, setKeepN] = useState(2);
  const [selected, setSelected] = useState<Record<string, boolean>>({ A: true, B: false, C: true, D: false, E: true });

  const patch = (p: Partial<Assumptions>) => setAssumptions((a) => ({ ...a, ...p }));
  const patchTax = (p: Partial<TaxIntake>) => setTaxIntake((t) => ({ ...t, ...p }));
  const patchIntake = (p: Partial<Intake>) => setIntake((i) => ({ ...i, ...p }));

  // Choosing a "next best option" also sets the comparison rate.
  const setBenchmark = (type: BenchmarkType) => {
    setBenchmarkType(type);
    const rate = type === "mortgage" ? assumptions.mortgageRate : BENCHMARKS[type].rate;
    if (rate != null) patch({ hurdle: rate });
  };

  const effectiveDeal = useMemo(() => withSalesChannel(deal, intake.salesChannel), [deal, intake.salesChannel]);
  const tax = useMemo(() => resolveTax(taxIntake), [taxIntake]);
  const gstOk = gstAnswered(taxIntake);

  const go = (s: number) => {
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <header className="top">
        <div className="brandmark">McK</div>
        <div>
          <h1>
            <span className="prod">Groundwork</span>
          </h1>
          <div className="sub">Development feasibility, financing &amp; capital strategy · McKenzie &amp; Co.</div>
        </div>
      </header>

      <nav className="steps">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={"step" + (i === step ? " active" : "") + (i < step ? " done" : "")}
            onClick={() => go(i)}
          >
            <span className="n">{i + 1}</span>
            {label}
          </div>
        ))}
      </nav>

      <main className="wrap">
        {step === 0 && <UploadStep deal={deal} setDeal={setDeal} onNext={() => go(2)} />}

        {step === 1 && <ComingSoon dealAddress={deal.address} lots={deal.lots} onSkip={() => go(2)} />}

        {step === 2 && (
          <OptionsStep
            deal={deal}
            assumptions={assumptions}
            patch={patch}
            taxIntake={taxIntake}
            patchTax={patchTax}
            benchmarkType={benchmarkType}
            setBenchmark={setBenchmark}
            intake={intake}
            patchIntake={patchIntake}
            keepN={keepN}
            setKeepN={setKeepN}
            selected={selected}
            setSelected={setSelected}
            onNext={() => go(3)}
          />
        )}

        {step === 3 && (
          <AnalysisStep
            deal={effectiveDeal}
            assumptions={assumptions}
            tax={tax}
            gstOk={gstOk}
            benchmarkType={benchmarkType}
            sellDown={intake.sellDown}
            keepN={keepN}
            selected={selected}
            onBack={() => go(2)}
          />
        )}

        <div className="foot">
          <b>Groundwork</b> — McKenzie &amp; Co. · Developing great places and people
          <br />
          GST &amp; income-tax estimates are indicative — confirm with a tax adviser before deciding.
        </div>
      </main>
    </>
  );
}

function ComingSoon({ dealAddress, lots, onSkip }: { dealAddress: string; lots: number; onSkip: () => void }) {
  return (
    <>
      <h2 className="sc-title">Confirm &amp; explore</h2>
      <p className="sc-sub">
        A short consultative chat verifies the deal and draws out the owner&rsquo;s real options and money-side inputs.
      </p>
      <div className="placeholder">
        <p style={{ margin: 0, fontWeight: 600 }}>Discovery chat — coming next.</p>
        <p style={{ margin: "8px 0 0" }}>
          For now, jump to Options &amp; finance — the intake questions (GST, tax, sales channel) live there.
          Loaded deal: <b>{lots}-lot subdivision · {dealAddress}</b>.
        </p>
        <div style={{ marginTop: 18 }}>
          <button className="btn" onClick={onSkip}>
            Go to Options &amp; finance →
          </button>
        </div>
      </div>
    </>
  );
}
