/** Display formatters (kept out of the engine so the engine stays pure numbers). */

export const fmt = (n: number): string =>
  (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-NZ");

export const fmtM = (n: number): string => "$" + (n / 1e6).toFixed(2) + "M";

export const pct = (n: number): string => (n * 100).toFixed(1) + "%";

export const signPct = (n: number): string => (n >= 0 ? "+" : "") + pct(n);
