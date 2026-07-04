/**
 * Display-time unwrapping of hard-wrapped note bodies. Case content is
 * authored with ~75-character line breaks; with resizable panes the browser
 * should own wrapping instead. Merges a newline into a space unless the next
 * line looks structural (list item, heading, label, timeline row) — then the
 * break is real and kept.
 */

const STRUCTURAL_LINE = [
  /^\s*$/, // blank — paragraph break
  /^\s*[-•*◆]\s/, // bullet list item
  /^\s*\d+[.)]\s/, // numbered list item
  /^\d{1,2}:\d{2}\b/, // timeline row ("05:50  Arrived in ED")
  /^[A-Z0-9][A-Z0-9 &/()'.—-]*:?\s*$/, // ALL-CAPS heading
  /^[A-Z][A-Za-z ()/+'-]{0,30}:/, // "Label:" line (CC:, Obs:, Drug:, ...)
  /^\[/, // bracketed status ("[Draft — not yet signed.]")
];

/**
 * Short capitalized standalone line: user section headers, signature names.
 * The word budget is tighter when judging the line ABOVE a break (a wrapped
 * prose line can plausibly end in 3 capitalized-start words, e.g. "First
 * paragraph ends") than when judging the line below it ("Dr R. Shah").
 */
function isShortStandalone(line: string, maxWords: number): boolean {
  const trimmed = line.trim();
  const words = trimmed.split(/\s+/);
  return (
    trimmed.length > 0 &&
    words.length <= maxWords &&
    /^[A-Z]/.test(trimmed) &&
    !/[.,;:]$/.test(trimmed)
  );
}

function keepsBreakBefore(line: string): boolean {
  return STRUCTURAL_LINE.some((pattern) => pattern.test(line)) || isShortStandalone(line, 3);
}

export function reflowNoteBody(body: string): string {
  const lines = body.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const previous = out.at(-1);
    const mergeable =
      previous !== undefined &&
      previous.trim() !== "" &&
      !previous.trimEnd().endsWith(":") &&
      // A heading stays on its own line: no merging INTO one either.
      !isShortStandalone(previous, 2) &&
      !keepsBreakBefore(line);
    if (mergeable) {
      out[out.length - 1] = `${previous.trimEnd()} ${line.trim()}`;
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}
