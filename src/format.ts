/** Display formatters (kept out of the engine so the engine stays pure numbers). */

export const fmt = (n: number): string =>
  (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-NZ");

export const fmtM = (n: number): string => "$" + (n / 1e6).toFixed(2) + "M";

export const pct = (n: number): string => (n * 100).toFixed(1) + "%";

/** Two-decimal percent — for small figures (e.g. cash yield) where 1dp rounds away the detail. */
export const pct2 = (n: number): string => (n * 100).toFixed(2) + "%";

export const signPct = (n: number): string => (n >= 0 ? "+" : "") + pct(n);
