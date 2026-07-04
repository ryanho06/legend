/** Plain-text extraction from the contentEditable note editor's HTML. */

/**
 * The editor produces a known dialect (divs per line, <br>, styled spans),
 * so a deterministic string transform beats DOMParser: identical output in
 * the browser and in node tests, no DOM dependency.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    // Break on block OPENS, not closes: the first editor line is a bare text
    // node, so "Impression<div>Plan</div>" must still split before "Plan".
    .replace(/<(div|p|h[1-6]|li|blockquote)(\s[^>]*)?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
