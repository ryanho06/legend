import { useEffect, useRef, useState } from "react";
import { Bold, CheckCircle2, Italic, Mic, Share2, Underline } from "lucide-react";
import { useCase } from "../../context/CaseContext";
import { matchPhrases, type SmartPhrase } from "../../lib/smarttext";

const NOTE_TYPES = [
  "Progress Note",
  "Post-Take Ward Round",
  "H&P",
  "Consult Note",
  "Procedure Note",
  "Nursing Note",
  "Discharge Summary",
];

const FONT_SIZES = [9, 10, 11, 12, 14];

const PLACEHOLDER = `PROGRESS NOTE
Seen on the ward round.

Subjective:
Objective:
Assessment: acute cholangitis...
Plan: cultures, antibiotics, source control (ERCP)...`;

type InlineFormat = { bold: boolean; italic: boolean; underline: boolean };

function countWords(text: string): number {
  // Strip zero-width spaces (used as font-size carets) before counting.
  const trimmed = text.replace(new RegExp(String.fromCharCode(0x200b), "g"), "").trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Snap a measured pt size to the closest value the dropdown offers. */
function nearestSize(pt: number): number {
  return FONT_SIZES.reduce((best, size) =>
    Math.abs(size - pt) < Math.abs(best - pt) ? size : best,
  );
}

/**
 * Editing surface for a single open note (one tab in the NoteEditorPanel). A
 * contentEditable region gives real inline bold/italic/underline on the
 * selection (toolbar toggles + Ctrl/Cmd+B/I/U); font size applies per run.
 *
 * The body is seeded once on mount (the component is keyed per draft, so it
 * remounts per tab) and pushed back out as HTML on input — we never write the
 * value prop back into the DOM, which keeps the caret stable.
 *
 * execCommand is deprecated but remains universally supported and is the
 * proportionate tool for this training mockup; no rich-text library is warranted.
 */
export function NoteEditor({
  noteType,
  service,
  value,
  mode,
  onChangeNoteType,
  onChange,
  onSign,
  onPend,
}: {
  noteType: string;
  service: string;
  value: string;
  mode?: "edit" | "addendum";
  onChangeNoteType: (noteType: string) => void;
  onChange: (value: string) => void;
  onSign: () => void;
  onPend: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  // The live selection inside the editor, saved on every interaction so the font
  // dropdown (which steals focus when opened) can restore it before applying.
  const savedRange = useRef<Range | null>(null);
  const [format, setFormat] = useState<InlineFormat>({
    bold: false,
    italic: false,
    underline: false,
  });
  const [fontSize, setFontSize] = useState(11);
  const [words, setWords] = useState(0);
  const activeCase = useCase();
  const { encounters } = activeCase;
  const [stQuery, setStQuery] = useState("");
  const [stIndex, setStIndex] = useState(0);
  const [wildcards, setWildcards] = useState(0);
  const stMatches = matchPhrases(stQuery);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = value;
    setWords(countWords(el.textContent ?? ""));
    setWildcards(el.querySelectorAll(".st-wildcard").length);
    // Seed once on mount; the value prop is intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track the editor's selection continuously, so it survives the font-size
  // <select> stealing focus — by the time onChange fires, the live selection may
  // be gone, but savedRange still holds the last real (non-collapsed) range.
  useEffect(() => {
    function capture() {
      const el = editorRef.current;
      const sel = window.getSelection();
      if (!el || !sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      if (el.contains(sel.anchorNode) && el.contains(sel.focusNode)) {
        savedRange.current = sel.getRangeAt(0).cloneRange();
      }
    }
    document.addEventListener("selectionchange", capture);
    return () => document.removeEventListener("selectionchange", capture);
  }, []);

  // Reflect the toolbar to whatever the caret/selection currently sits on.
  function syncState() {
    const el = editorRef.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return;
    if (el.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
    setFormat({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
    });
    const anchor = sel.anchorNode;
    const node = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : (anchor as HTMLElement | null);
    if (node && el.contains(node)) {
      const px = parseFloat(getComputedStyle(node).fontSize);
      if (px) setFontSize(nearestSize((px * 72) / 96));
    }
  }

  function pushChange() {
    const el = editorRef.current;
    if (!el) return;
    onChange(el.innerHTML);
    setWords(countWords(el.textContent ?? ""));
    setWildcards(el.querySelectorAll(".st-wildcard").length);
  }

  function applyFormat(command: "bold" | "italic" | "underline") {
    editorRef.current?.focus();
    document.execCommand(command);
    syncState();
    pushChange();
  }

  // Apply a point size by wrapping the saved range in a styled <span> directly —
  // no execCommand, no focus requirement — so it works even though the <select>
  // took focus when it was clicked. Two cases: a real selection is wrapped so only
  // those characters change; a bare caret gets an empty styled span (seeded with a
  // zero-width space) with the caret inside, so the next typed text inherits the size.
  function applyFontSize(size: number) {
    setFontSize(size);
    const el = editorRef.current;
    const range = savedRange.current;
    if (!el || !range) return;
    const span = document.createElement("span");
    span.style.fontSize = `${size}pt`;
    const caret = document.createRange();
    if (range.collapsed) {
      const zwsp = document.createTextNode(String.fromCharCode(0x200b));
      span.appendChild(zwsp);
      range.insertNode(span);
      caret.setStart(zwsp, 1);
      caret.collapse(true);
    } else {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      caret.selectNodeContents(span);
    }
    // Refocus the editor with the caret/selection on the styled span, so the
    // change stays put and the dropdown keeps reflecting it without a reclick.
    el.focus();
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(caret);
    savedRange.current = caret.cloneRange();
    pushChange();
  }

  // Select a whole wildcard chip so the next keystroke replaces it outright.
  function selectChip(chip: Element) {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNode(chip);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    savedRange.current = range.cloneRange();
    (chip as HTMLElement).scrollIntoView({ block: "nearest" });
  }

  /** The next/previous wildcard chip from the caret, wrapping around. */
  function findChip(forward: boolean): Element | null {
    const el = editorRef.current;
    if (!el) return null;
    const chips = Array.from(el.querySelectorAll(".st-wildcard"));
    if (chips.length === 0) return null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
      return forward ? chips[0] : chips[chips.length - 1];
    }
    const caret = sel.getRangeAt(0);
    const isAfterCaret = (chip: Element) => {
      const range = document.createRange();
      range.selectNode(chip);
      return range.compareBoundaryPoints(Range.START_TO_START, caret) > 0;
    };
    if (forward) return chips.find(isAfterCaret) ?? chips[0];
    // Backward: last chip before the caret, excluding a currently selected chip.
    const before = chips.filter(
      (chip) => !isAfterCaret(chip) && !caret.intersectsNode(chip),
    );
    return before[before.length - 1] ?? chips[chips.length - 1];
  }

  // Splice the template at the last saved caret (end of note if none), then
  // jump to its first wildcard so the trainee starts filling immediately.
  function insertPhrase(phrase: SmartPhrase) {
    const el = editorRef.current;
    if (!el) return;
    const admissionDate = encounters.find((e) => e.admission)?.date ?? "";
    const html = phrase.build(activeCase, admissionDate);
    let range = savedRange.current;
    if (!range || !el.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
    }
    range.deleteContents();
    const fragment = document.createRange().createContextualFragment(html);
    const firstChip = fragment.querySelector(".st-wildcard");
    range.insertNode(fragment);
    setStQuery("");
    setStIndex(0);
    if (firstChip) {
      selectChip(firstChip);
    } else {
      el.focus();
    }
    pushChange();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Tab") {
      const chip = findChip(!event.shiftKey);
      if (chip) {
        event.preventDefault();
        selectChip(chip);
        return;
      }
    }
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const key = event.key.toLowerCase();
      const command =
        key === "b" ? "bold" : key === "i" ? "italic" : key === "u" ? "underline" : null;
      if (command) {
        event.preventDefault();
        applyFormat(command);
      }
    }
  }

  return (
    <div className="note-editor-content">
      <div className="note-editor-titlebar">
        <div className="note-editor-meta">
          {mode === "addendum" ? (
            <span className="note-editor-fixed-type">Addendum</span>
          ) : (
            <select
              value={noteType}
              aria-label="Note type"
              onChange={(event) => onChangeNoteType(event.target.value)}
            >
              {NOTE_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          )}
          <span>{service} · Today</span>
        </div>
      </div>

      <div className="note-editor-format">
        <select
          value={fontSize}
          aria-label="Font size"
          onChange={(event) => applyFontSize(Number(event.target.value))}
        >
          {FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <FormatButton label="Bold" active={format.bold} onClick={() => applyFormat("bold")}>
          <Bold size={13} />
        </FormatButton>
        <FormatButton label="Italic" active={format.italic} onClick={() => applyFormat("italic")}>
          <Italic size={13} />
        </FormatButton>
        <FormatButton
          label="Underline"
          active={format.underline}
          onClick={() => applyFormat("underline")}
        >
          <Underline size={13} />
        </FormatButton>
        <div className="note-editor-smarttext-wrap">
          <input
            className="note-editor-smarttext"
            placeholder="Insert SmartText"
            aria-label="Insert SmartText"
            value={stQuery}
            onChange={(event) => {
              setStQuery(event.target.value);
              setStIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setStIndex((i) => Math.min(i + 1, stMatches.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setStIndex((i) => Math.max(i - 1, 0));
              } else if (event.key === "Enter" && stMatches[stIndex]) {
                event.preventDefault();
                insertPhrase(stMatches[stIndex]);
              } else if (event.key === "Escape") {
                setStQuery("");
                setStIndex(0);
              }
            }}
          />
          {stMatches.length > 0 && (
            <ul className="st-suggest" role="listbox">
              {stMatches.map((phrase, index) => (
                <li key={phrase.id}>
                  <button
                    role="option"
                    aria-selected={index === stIndex}
                    className={index === stIndex ? "active" : undefined}
                    // Keep the editor's saved caret; don't move focus on click.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertPhrase(phrase)}
                  >
                    <b>{phrase.id}</b>
                    <span>{phrase.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button aria-label="Dictate">
          <Mic size={13} />
        </button>
      </div>

      <div
        ref={editorRef}
        className="note-editor-textarea"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Note body"
        data-placeholder={PLACEHOLDER}
        onInput={pushChange}
        onKeyDown={handleKeyDown}
        onKeyUp={syncState}
        onMouseUp={syncState}
        onClick={(event) => {
          const chip = (event.target as HTMLElement).closest(".st-wildcard");
          if (chip) selectChip(chip);
        }}
      />

      <div className="note-editor-footer">
        <span className="note-editor-wordcount">{words} words</span>
        <div className="toolbar-spacer" />
        {/* Pend files the draft as an incomplete note; Sign publishes it and
            opens Wrap-Up feedback. Both disabled while the note is empty. */}
        {mode !== "addendum" && (
          <button onClick={onPend} disabled={words === 0}>
            Pend
          </button>
        )}
        <button>
          <Share2 size={13} />
          Share
        </button>
        <button
          className="green-button"
          onClick={onSign}
          disabled={words === 0 || wildcards > 0}
          title={wildcards > 0 ? "Complete all *** fields before signing" : undefined}
        >
          <CheckCircle2 size={13} />
          Sign
        </button>
      </div>
    </div>
  );
}

function FormatButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={active ? "fmt-button active" : "fmt-button"}
      // Keep the editor selection intact when the toolbar takes focus.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
