import { LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fetchAliases, switchAlias, type Alias } from "../../lib/api";
import { gradeLabel } from "../../lib/grades";
import { signOut } from "../../lib/session";
import type { Grade, UserProfile } from "../../types";

/** True when an alias row is the trainee's current persona (so it is not a
 * "previous" alias worth offering as a switch target). */
function isCurrent(alias: Alias, user: UserProfile): boolean {
  return (
    alias.hcpId === user.hcpId &&
    (alias.forename ?? "") === user.forename &&
    (alias.surname ?? "") === user.surname &&
    (alias.grade ?? "") === user.grade
  );
}

/**
 * Popover anchored to the top-right user bubble. Shows the current persona, any
 * previous aliases with a Switch action, and Sign out. Switching swaps the user
 * row server-side (outside better-auth), so we reload to re-derive the session
 * persona — the same reload signOut already performs.
 */
export function ProfileMenu({ user, onClose }: { user: UserProfile; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [aliases, setAliases] = useState<Alias[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchAliases()
      .then((r) => live && setAliases(r.aliases))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onDown(e: MouseEvent) {
      const target = e.target as Element;
      // Clicks on the bubble/anchor are handled by the bubble's own toggle;
      // only close on a genuine outside click.
      if (ref.current && !ref.current.contains(target) && !target.closest(".profile-anchor")) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  const previous = (aliases ?? []).filter((a) => !isCurrent(a, user));

  async function onSwitch(id: string) {
    setSwitching(id);
    try {
      await switchAlias(id);
      window.location.reload();
    } catch {
      setSwitching(null);
      setFailed(true);
    }
  }

  const initials = `${(user.forename[0] ?? "").toUpperCase()}${(user.surname[0] ?? "").toUpperCase()}`;

  return (
    <div className="profile-menu" ref={ref} role="dialog" aria-label="Profile">
      <div className="profile-current">
        <span className="profile-avatar">
          {user.image ? (
            <img src={user.image} alt="" referrerPolicy="no-referrer" />
          ) : (
            initials
          )}
        </span>
        <span className="profile-id">
          <span className="profile-name">
            {user.forename} {user.surname}
          </span>
          <span className="profile-meta">{gradeLabel(user.grade)}</span>
          <span className="profile-hcp">ID {user.hcpId}</span>
        </span>
      </div>

      <div className="profile-section-label">Previous aliases</div>

      {failed ? (
        <div className="profile-empty">Could not load aliases.</div>
      ) : aliases === null ? (
        <div className="profile-empty">Loading…</div>
      ) : previous.length === 0 ? (
        <div className="profile-empty">No previous aliases yet.</div>
      ) : (
        <ul className="profile-alias-list">
          {previous.map((a) => (
            <li key={a.id} className="profile-alias">
              <span className="profile-alias-id">
                <span className="profile-alias-name">
                  {a.forename} {a.surname}
                </span>
                <span className="profile-alias-meta">
                  {a.grade ? gradeLabel(a.grade as Grade) : "—"} · {a.hcpId}
                </span>
              </span>
              <button
                className="profile-switch"
                disabled={switching !== null}
                onClick={() => onSwitch(a.id)}
              >
                {switching === a.id ? "Switching…" : "Switch"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        className="profile-signout"
        onClick={() => {
          if (
            window.confirm(
              "Sign out? This clears your sticky notes on this device so the next trainee starts fresh.",
            )
          ) {
            void signOut();
          }
        }}
      >
        <LogOut size={14} />
        Sign out
      </button>
    </div>
  );
}
