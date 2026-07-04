import { Bell, Menu, Search, StickyNote } from "lucide-react";
import { signOut } from "../../lib/session";
import type { UserProfile } from "../../types";

export function TopSystemBar({
  stickyOpen,
  onToggleSticky,
  user,
}: {
  stickyOpen: boolean;
  onToggleSticky: () => void;
  user: UserProfile;
}) {
  return (
    <header className="top-system-bar">
      <div className="top-left">
        <button className="icon-button dark">
          <Menu size={17} />
        </button>
        <div className="brand-chip">
          <span className="brand-logo">L</span>
          <span className="brand-text">LegendCare</span>
        </div>
        <span className="environment-text">
          TRAINING — REHAB / ORTHO / GENERAL SURGERY — AMELIA HART
        </span>
      </div>

      <div className="global-search">
        <Search size={15} />
        <span>Search synthetic chart...</span>
      </div>

      <div className="top-right">
        <button
          className={stickyOpen ? "top-pill sticky-toggle active" : "top-pill sticky-toggle"}
          onClick={onToggleSticky}
          aria-pressed={stickyOpen}
        >
          <StickyNote size={14} />
          Sticky Note
        </button>

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
              signOut("cholangitis001");
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
