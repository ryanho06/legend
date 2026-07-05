import { Activity, X } from "lucide-react";
import type { ClinicalNote, NoteDraft } from "../../types";
import { WrapUpModule } from "./WrapUpModule";

/**
 * Floating bottom-left dock for the note-feedback ("Wrap-Up") activity. It is
 * deliberately NOT a main EMR tab: feedback is a training overlay, so it lives
 * as a launcher pill plus a floating panel (like the sticky note). Signing a
 * note opens it automatically.
 */
export function WrapUpDock({
  open,
  onToggle,
  onClose,
  editors,
  userNotes,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  editors: NoteDraft[];
  userNotes: ClinicalNote[];
}) {
  return (
    <div className="wrapup-dock">
      {open && (
        <div className="wrapup-dock-panel" role="dialog" aria-label="Note feedback">
          <div className="wrapup-dock-head">
            <span>
              <Activity size={14} /> Performance — note feedback
            </span>
            <button aria-label="Close feedback" onClick={onClose}>
              <X size={14} />
            </button>
          </div>
          <div className="wrapup-dock-body">
            <WrapUpModule editors={editors} userNotes={userNotes} embedded />
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
