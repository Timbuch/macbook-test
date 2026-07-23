/* api/extract/index.js — Groundwork PDF → Deal extraction.
 *
 * POST /api/extract
 * Body: { valuationBase64?: string, planBase64?: string, valuationText?: string }
 *   - base64 PDFs are decoded and their text layer extracted server-side.
 * Response: { deal: Deal, confidence?: object, usage?: object }
 *
 * Reads the uploaded market valuation (and optional scheme plan), then asks
 * Claude — via the shared mck-claude-proxy (server-to-server; the proxy holds
 * the Anthropic key) — to return a structured Deal. Anonymous by design: this
 * app is public. See README for the compulsory-registration / cost note.
 */

// Bypass pdf-parse's index.js debug wrapper (which runs test code when required
// at the top level) by importing the library module directly.
const pdf = require("pdf-parse/lib/pdf-parse.js");

const CLAUDE_PROXY_URL =
  process.env.CLAUDE_PROXY_URL ||
  "https://mck-claude-proxy-gbe0a9fnf4ajg4am.newzealandnorth-01.azurewebsites.net/api/claude";
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";

const MAX_TEXT = 60000; // keep the prompt bounded

const SYSTEM = `You are a New Zealand development-feasibility analyst. You read a market valuation and (optionally) a subdivision scheme plan and extract a structured deal. Return ONLY a single JSON object, no prose, no code fences.

Schema (all money GST-inclusive where the document is, numbers only — no "$" or commas):
{
  "address": string,
  "lots": integer,                        // number of titles/sections created
  "asIsValue": number,                    // current "as is" market value
  "grossRealisationInclGST": number,      // sum of individual finished section values, incl GST
  "saleInOneLineInclGST": number,         // one-line / bulk value, incl GST (estimate ~0.8x gross if absent)
  "civilCost": number,                    // civil + development works to create titles (from the residual analysis)
  "gstRate": 0.15,
  "commission": 0.0275,                    // agent commission fraction (default 0.0275 if not stated)
  "marketingLegalPerLot": 3000,
  "confidence": { "<field>": "high" | "low" }  // your confidence per numeric field
}
If a value is genuinely absent, estimate it and mark that field "low" in confidence.`;

async function textFromBase64(b64) {
  const buf = Buffer.from(b64, "base64");
  const data = await pdf(buf);
  return (data.text || "").trim();
}

module.exports = async function (context, req) {
  const respond = (status, body) => {
    context.res = { status, headers: { "Content-Type": "application/json" }, body };
  };

  try {
    const { valuationBase64, planBase64, valuationText } = req.body || {};

    let valText = (valuationText || "").trim();
    let planText = "";
    try {
      if (!valText && valuationBase64) valText = await textFromBase64(valuationBase64);
      if (planBase64) planText = await textFromBase64(planBase64);
    } catch (e) {
      return respond(422, {
        error: "pdf_parse_failed",
        message: "Could not read the PDF text layer. It may be a scanned image — enter the deal manually for now.",
      });
    }

    if (!valText) {
      return respond(400, { error: "no_input", message: "Provide a valuation PDF (valuationBase64) or valuationText." });
    }

    const user =
      `MARKET VALUATION:\n${valText.slice(0, MAX_TEXT)}\n\n` +
      (planText ? `SCHEME PLAN:\n${planText.slice(0, MAX_TEXT / 3)}\n\n` : "") +
      `Extract the deal as the JSON object described. Focus on the valuation reconciliation / residual table.`;

    // The mck-claude-proxy forwards to Anthropic's Messages API, so send native
    // format ({ model, system, messages }) and read content[0].text back.
    const resp = await fetch(CLAUDE_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{ role: "user", content: user }],
      }),
    });
    const raw = await resp.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch (_) { /* non-JSON */ }

    const modelText = data.text ?? data.content?.[0]?.text ?? "";
    if (!resp.ok || !modelText) {
      context.log.error(`Claude proxy ${resp.status}: ${raw.slice(0, 400)}`);
      return respond(502, { error: "proxy_error", message: `Claude proxy returned ${resp.status}.` });
    }

    // Strip any accidental code fences and parse the JSON deal.
    const jsonText = modelText.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (_) {
      return respond(502, { error: "bad_json", message: "Extraction did not return valid JSON.", raw: data.text.slice(0, 400) });
    }

    const confidence = parsed.confidence || {};
    delete parsed.confidence;
    const deal = {
      gstRate: 0.15,
      commission: 0.0275,
      marketingLegalPerLot: 3000,
      ...parsed,
    };

    return respond(200, { deal, confidence, usage: data.usage });
  } catch (err) {
    context.log.error("extract failed:", err.message);
    return respond(500, { error: "server_error", message: err.message });
  }
};
