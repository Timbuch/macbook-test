import { useRef, useState } from "react";
import type { Deal } from "../engine";
import { CLEVEDON_DEAL } from "../defaults";

interface Props {
  deal: Deal;
  setDeal: (d: Deal) => void;
  onNext: () => void;
}

type Status = "idle" | "reading" | "extracting" | "done" | "error";

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

export function UploadStep({ setDeal, onNext }: Props) {
  const [valFile, setValFile] = useState<File | null>(null);
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const valRef = useRef<HTMLInputElement>(null);
  const planRef = useRef<HTMLInputElement>(null);

  async function extract() {
    if (!valFile) return;
    setStatus("reading");
    setMessage("Reading the PDF…");
    try {
      const valuationBase64 = await toBase64(valFile);
      const planBase64 = planFile ? await toBase64(planFile) : undefined;
      setStatus("extracting");
      setMessage("Groundwork is reading the valuation and drafting the deal…");
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valuationBase64, planBase64 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Extraction failed (${res.status}).`);
      }
      const { deal } = await res.json();
      if (!deal || !deal.lots || !deal.asIsValue) throw new Error("Extraction returned an incomplete deal.");
      setDeal({ ...CLEVEDON_DEAL, ...deal });
      setStatus("done");
      setMessage(`Drafted: ${deal.lots}-lot deal at ${deal.address ?? "the site"}.`);
    } catch (e) {
      setStatus("error");
      setMessage(
        (e as Error).message +
          " The extraction back end may not be wired up yet — you can continue with the loaded Clevedon deal.",
      );
    }
  }

  const busy = status === "reading" || status === "extracting";

  return (
    <>
      <h2 className="sc-title">Upload</h2>
      <p className="sc-sub">
        Drop in the market valuation and the subdivision scheme plan. Groundwork reads them and drafts the deal for
        you to confirm. No sign-in — this tool is open to anyone with the link.
      </p>

      <div className="grid2">
        <DropZone
          label="Market valuation (PDF)"
          hint="Required — the reconciliation / residual table is the key input."
          file={valFile}
          inputRef={valRef}
          onPick={(f) => { setValFile(f); setStatus("idle"); }}
        />
        <DropZone
          label="Subdivision scheme plan (PDF)"
          hint="Optional — confirms lot count and areas."
          file={planFile}
          inputRef={planRef}
          onPick={(f) => { setPlanFile(f); setStatus("idle"); }}
        />
      </div>

      {message && (
        <div
          className="callout"
          style={{
            marginTop: 16,
            background: status === "error" ? "#fdf0e6" : "var(--water-tint)",
            borderLeft: `3px solid ${status === "error" ? "var(--amber)" : "var(--water)"}`,
          }}
        >
          {message}
        </div>
      )}

      <div className="actions">
        <button className="btn" onClick={extract} disabled={!valFile || busy}>
          {busy ? "Reading…" : "Read & draft the deal"}
        </button>
        {status === "done" ? (
          <button className="btn sec" onClick={onNext}>Confirm the deal →</button>
        ) : (
          <button className="btn ghost" onClick={onNext}>Skip — use the loaded Clevedon deal →</button>
        )}
      </div>
    </>
  );
}

function DropZone({
  label,
  hint,
  file,
  inputRef,
  onPick,
}: {
  label: string;
  hint: string;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement>;
  onPick: (f: File) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      className="placeholder"
      style={{ cursor: "pointer", borderColor: over ? "var(--moss)" : undefined, background: over ? "var(--moss-tint)" : undefined }}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onPick(f);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); }}
      />
      <p style={{ margin: 0, fontWeight: 600 }}>{file ? `📄 ${file.name}` : label}</p>
      <p style={{ margin: "8px 0 0", fontSize: 12.5 }}>{file ? "Click to replace" : hint}</p>
    </div>
  );
}
