import { describe, expect, test } from "vitest";
import { htmlToPlainText, wordCount } from "./noteText";

describe("htmlToPlainText", () => {
  test("converts contentEditable div lines to newlines", () => {
    const html = "<div>Impression</div><div>Acute cholangitis</div>";
    expect(htmlToPlainText(html)).toBe("Impression\nAcute cholangitis");
  });

  test("converts <br> to newlines", () => {
    expect(htmlToPlainText("line one<br>line two")).toBe("line one\nline two");
  });

  test("strips styled spans but keeps their text", () => {
    const html = '<div><span style="font-size: 14px"><b>Bili</b> 96</span></div>';
    expect(htmlToPlainText(html)).toBe("Bili 96");
  });

  test("decodes common entities", () => {
    expect(htmlToPlainText("ALP&nbsp;402 &amp; GGT &lt;400&gt; &quot;high&quot;")).toBe(
      'ALP 402 & GGT <400> "high"',
    );
  });

  test("collapses runs of blank lines and trims", () => {
    const html = "<div>one</div><div><br></div><div><br></div><div>two</div>";
    expect(htmlToPlainText(html)).toBe("one\n\ntwo");
  });

  test("returns plain text unchanged", () => {
    expect(htmlToPlainText("just plain text")).toBe("just plain text");
  });

  test("keeps a leading unwrapped text node on its own line", () => {
    // contentEditable leaves the first line as a bare text node.
    const html = "Impression<div>Acute cholangitis</div><div>Plan</div>";
    expect(htmlToPlainText(html)).toBe("Impression\nAcute cholangitis\nPlan");
  });
});

describe("wordCount", () => {
  test("counts whitespace-separated words", () => {
    expect(wordCount("obstructive LFT pattern with fever")).toBe(5);
  });

  test("ignores extra whitespace and blank text", () => {
    expect(wordCount("  a\n\n b  ")).toBe(2);
    expect(wordCount("")).toBe(0);
    expect(wordCount("   \n ")).toBe(0);
  });
});
