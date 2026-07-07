import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Activity, X } from "lucide-react";
import type { ClinicalNote, NoteDraft, UserProfile } from "../../types";
import { WrapUpModule } from "./WrapUpModule";

const MIN_W = 320;
const MIN_H = 220;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/**
 * Floating bottom-left dock for the note-feedback ("Wrap-Up") activity. It is
 * deliberately NOT a main EMR tab: feedback is a training overlay, so it lives
 * as a launcher pill plus a floating panel (like the sticky note). Signing a
 * note opens it automatically.
 *
 * The panel is anchored at its bottom-left, so it is resized from a custom
 * top-right grip (CSS `resize` only offers a bottom-right handle, which fights
 * the anchor): dragging up/right enlarges it while the bottom-left stays put.
 */
export function WrapUpDock({
  open,
  onToggle,
  onClose,
  editors,
  userNotes,
  user,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  editors: NoteDraft[];
  userNotes: ClinicalNote[];
  user: UserProfile;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const panel = panelRef.current;
    if (!panel) return;
    const start = {
      x: event.clientX,
      y: event.clientY,
      w: panel.offsetWidth,
      h: panel.offsetHeight,
    };
    // Bottom-left is pinned: dragging right grows width, dragging UP grows height.
    function move(ev: PointerEvent) {
      const maxW = window.innerWidth - 24;
      const maxH = Math.round(window.innerHeight * 0.86);
      setSize({
        w: clamp(start.w + (ev.clientX - start.x), MIN_W, maxW),
        h: clamp(start.h + (start.y - ev.clientY), MIN_H, maxH),
      });
    }
    function stop() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  return (
    <div className="wrapup-dock">
      {open && (
        <div
          className="wrapup-dock-panel"
          role="dialog"
          aria-label="Note feedback"
          ref={panelRef}
          style={size ? { width: size.w, height: size.h } : undefined}
        >
          <div
            className="wrapup-dock-resize"
            onPointerDown={startResize}
            role="separator"
            aria-label="Resize feedback panel"
          />
          <div className="wrapup-dock-head">
            <span>
              <Activity size={14} /> Performance — note feedback
            </span>
            <button aria-label="Close feedback" onClick={onClose}>
              <X size={14} />
            </button>
          </div>
          <div className="wrapup-dock-body">
            <WrapUpModule editors={editors} userNotes={userNotes} user={user} embedded />
          </div>
        </div>
      )}

      <button
        className={open ? "wrapup-launcher active" : "wrapup-launcher"}
        onClick={onToggle}
        aria-pressed={open}
        title="Note-feedback performance"
      >
        <Activity size={15} />
        Performance
      </button>
    </div>
  );
}
