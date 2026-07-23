import { useMemo, useState } from "react";
import type { Assumptions, Deal } from "./engine";
import { CLEVEDON_DEAL, DEFAULT_ASSUMPTIONS } from "./defaults";
import { OptionsStep } from "./steps/OptionsStep";
import { AnalysisStep } from "./steps/AnalysisStep";

const STEPS = ["Upload", "Confirm & explore", "Options & finance", "Capital analysis"];

export function App() {
  const [step, setStep] = useState(2); // Steps 1–2 need the extraction/chat backend; start on Options
  const [deal] = useState<Deal>(CLEVEDON_DEAL);
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [keepN, setKeepN] = useState(2);
  const [selected, setSelected] = useState<Record<string, boolean>>({ A: true, B: false, C: true, D: false });

  const patch = (p: Partial<Assumptions>) => setAssumptions((a) => ({ ...a, ...p }));

  const go = (s: number) => {
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const dealSummary = useMemo(
    () => `${deal.lots}-lot subdivision · ${deal.address}`,
    [deal],
  );

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
        {step < 2 && <ComingSoon step={step} dealSummary={dealSummary} onSkip={() => go(2)} />}

        {step === 2 && (
          <OptionsStep
            deal={deal}
            assumptions={assumptions}
            patch={patch}
            keepN={keepN}
            setKeepN={setKeepN}
            selected={selected}
            setSelected={setSelected}
            onNext={() => go(3)}
          />
        )}

        {step === 3 && (
          <AnalysisStep
            deal={deal}
            assumptions={assumptions}
            keepN={keepN}
            selected={selected}
            onBack={() => go(2)}
          />
        )}

        <div className="foot">
          <b>Groundwork</b> — McKenzie &amp; Co. · Developing great places and people
          <br />
          Before-tax, interest-only model. Hold-option returns are indicative until the tax layer lands.
        </div>
      </main>
    </>
  );
}

function ComingSoon({ step, dealSummary, onSkip }: { step: number; dealSummary: string; onSkip: () => void }) {
  const isUpload = step === 0;
  return (
    <>
      <h2 className="sc-title">{isUpload ? "Upload" : "Confirm & explore"}</h2>
      <p className="sc-sub">
        {isUpload
          ? "Drop in the market valuation and the subdivision scheme plan. Groundwork reads them and drafts the deal for you to confirm."
          : "A short consultative chat verifies the deal and draws out the owner's real options and money-side inputs."}
      </p>
      <div className="placeholder">
        <p style={{ margin: 0, fontWeight: 600 }}>
          {isUpload ? "PDF extraction pipeline" : "Discovery chat"} — coming next.
        </p>
        <p style={{ margin: "8px 0 0" }}>
          This step needs the Azure Function + LLM back end. For now the model is pre-loaded with the
          Clevedon deal: <b>{dealSummary}</b>.
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
