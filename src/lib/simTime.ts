/**
 * Sim-time formatting. Every formatter takes Unix epoch SECONDS and formats in
 * UTC, so a case's authored dates render identically in every timezone: a chart
 * frozen at 16/06/2026 must never display as 15/06 for a viewer west of UTC.
 */

function parts(epochSec: number) {
  const d = new Date(epochSec * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    dd: pad(d.getUTCDate()),
    mm: pad(d.getUTCMonth() + 1),
    yyyy: String(d.getUTCFullYear()),
    yy: pad(d.getUTCFullYear() % 100),
    hh: pad(d.getUTCHours()),
    min: pad(d.getUTCMinutes()),
  };
}

/** "DD/MM/YYYY". */
export function formatDate(epochSec: number): string {
  const p = parts(epochSec);
  return `${p.dd}/${p.mm}/${p.yyyy}`;
}

/** "HH:MM" (24h). */
export function formatTime(epochSec: number): string {
  const p = parts(epochSec);
  return `${p.hh}:${p.min}`;
}

/** "DD/MM/YY HHMM": the note-row Date of Service / File Time stamp. */
export function formatNoteStamp(epochSec: number): string {
  const p = parts(epochSec);
  return `${p.dd}/${p.mm}/${p.yy} ${p.hh}${p.min}`;
}

/**
 * The case's current sim-time in epoch seconds: the case anchor plus a sim
 * offset (`simNow`, seconds since the anchor). Falls back to the real wall
 * clock for legacy cases with no anchor (offset ignored there); like every
 * display in the app that instant is rendered in UTC (this module's invariant).
 */
export function caseNow(anchor: number | undefined, offset = 0): number {
  return anchor === undefined ? Math.floor(Date.now() / 1000) : anchor + offset;
}
