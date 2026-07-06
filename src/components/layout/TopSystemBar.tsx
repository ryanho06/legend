import { Bell, Menu, StickyNote } from "lucide-react";
import { signOut } from "../../lib/session";
import type { CasePatient, UserProfile } from "../../types";

export function TopSystemBar({
  stickyOpen,
  onToggleSticky,
  onMenu,
  user,
  activePatient,
}: {
  stickyOpen: boolean;
  onToggleSticky: () => void;
  /** Opens the Patient Lists activity. */
  onMenu: () => void;
  user: UserProfile;
  /** Drives the environment banner; absent when no chart is open. */
  activePatient?: CasePatient;
}) {
  const environment = activePatient
    ? `TRAINING — ${activePatient.specialty} — ${activePatient.forename} ${activePatient.surname}`
    : "TRAINING — MOUNT VERDANT HOSPITAL";
  return (
    <header className="top-system-bar">
      <div className="top-left">
        <button
          className="icon-button dark"
          aria-label="Patient Lists"
          title="Patient Lists"
          onClick={onMenu}
        >
          <Menu size={17} />
        </button>
        <div className="brand-chip">
          <span className="brand-logo">L</span>
          <span className="brand-text">LegendCare</span>
        </div>
        <span className="environment-text">{environment.toUpperCase()}</span>
      </div>

      <div className="top-right">
        {activePatient && (
          <button
            className={stickyOpen ? "top-pill sticky-toggle active" : "top-pill sticky-toggle"}
            onClick={onToggleSticky}
            aria-pressed={stickyOpen}
          >
            <StickyNote size={14} />
            Sticky Note
          </button>
        )}

        <Bell size={16} />
        <button
          className="user-bubble"
          title={`${user.forename} ${user.surname} — Medical Student. Click to sign out and reset the demo.`}
          onClick={() => {
            if (
              window.confirm(
                "Sign out? This clears your notes and feedback so the next trainee starts fresh.",
              )
            ) {
              signOut();
            }
          }}
        >
          {(user.forename[0] ?? "").toUpperCase()}
          {(user.surname[0] ?? "").toUpperCase()}
        </button>
      </div>
    </header>
  );
}
