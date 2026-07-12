import { Bell, Menu, StickyNote } from "lucide-react";
import { useState } from "react";
import type { CasePatient, UserProfile } from "../../types";
import { ProfileMenu } from "./ProfileMenu";

export function TopSystemBar({
  stickyOpen,
  onToggleSticky,
  onMenu,
  user,
  activePatient,
  taskLabel,
}: {
  stickyOpen: boolean;
  onToggleSticky: () => void;
  /** Opens the Patient Lists activity. */
  onMenu: () => void;
  user: UserProfile;
  /** Drives the environment banner; absent when no chart is open. */
  activePatient?: CasePatient;
  /** The active case's task label (e.g. "WARD ROUND REVIEW"), shown with the specialty. */
  taskLabel?: string;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  // With a chart open, the environment banner names the job to do
  // (SPECIALTY — TASK, e.g. "GENERAL SURGERY — WARD ROUND REVIEW"); on the
  // Patient Lists activity it names the hospital.
  const environment =
    activePatient && taskLabel
      ? `${activePatient.specialty} — ${taskLabel}`
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
        <div className="profile-anchor">
          <button
            className="user-bubble"
            title={`${user.forename} ${user.surname} — profile and aliases`}
            aria-haspopup="dialog"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((open) => !open)}
          >
            {user.image ? (
              <img
                className="user-bubble-avatar"
                src={user.image}
                alt=""
                referrerPolicy="no-referrer"
              />
            ) : (
              <>
                {(user.forename[0] ?? "").toUpperCase()}
                {(user.surname[0] ?? "").toUpperCase()}
              </>
            )}
          </button>
          {profileOpen && <ProfileMenu user={user} onClose={() => setProfileOpen(false)} />}
        </div>
      </div>
    </header>
  );
}
