import { useState } from "react";
import { LogIn } from "lucide-react";
import { GRADES } from "../lib/grades";
import type { Grade } from "../types";

export type PersonaInput = { forename: string; surname: string; grade: Grade };

/**
 * Sign-in gate: "signin" mode offers the guest (anonymous) form plus Google;
 * "persona" mode is shown to a signed-in Google account that hasn't yet
 * captured a persona (forename/surname/grade), prefilled from the Google name.
 * Persona fields feed display and note authorship; hcpId is server-owned.
 */
export function SignInPage({
  mode,
  initialName,
  onComplete,
  onGoogle,
}: {
  mode: "signin" | "persona";
  initialName?: { forename: string; surname: string };
  onComplete: (persona: PersonaInput) => Promise<void>;
  onGoogle: () => void;
}) {
  const [forename, setForename] = useState(initialName?.forename ?? "");
  const [surname, setSurname] = useState(initialName?.surname ?? "");
  const [grade, setGrade] = useState<Grade>("fy");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = forename.trim().length > 0 && surname.trim().length > 0 && !saving;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setSaving(true);
    setError(null);
    try {
      await onComplete({ forename: forename.trim(), surname: surname.trim(), grade });
    } catch {
      setError("Could not start the session. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="signin-overlay">
      <form className="signin-card" onSubmit={submit}>
        <div className="signin-brand">
          <span className="brand-logo">L</span>
          <span className="signin-brand-name">LegendCare</span>
        </div>
        <div className="signin-env">TRAINING ENVIRONMENT</div>

        <label className="signin-field">
          First name
          <input
            autoFocus
            name="forename"
            value={forename}
            onChange={(event) => setForename(event.target.value)}
            placeholder="e.g. Jordan"
          />
        </label>
        <label className="signin-field">
          Last name
          <input
            name="surname"
            value={surname}
            onChange={(event) => setSurname(event.target.value)}
            placeholder="e.g. Lee"
          />
        </label>
        <label className="signin-field">
          Hierarchy
          <select value={grade} onChange={(event) => setGrade(event.target.value as Grade)}>
            {GRADES.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.label} ({entry.usLabel})
              </option>
            ))}
          </select>
        </label>

        {error && <div className="signin-error">{error}</div>}

        <button className="signin-submit" type="submit" disabled={!ready}>
          <LogIn size={14} />
          {mode === "persona" ? "Save and start training" : "Start training"}
        </button>

        {mode === "signin" && (
          <>
            <div className="signin-divider">or</div>
            <button
              className="signin-submit signin-google"
              type="button"
              onClick={onGoogle}
            >
              <LogIn size={14} />
              Sign in with Google
            </button>
          </>
        )}

        <div className="signin-disclaimer">
          All patient data are synthetic. For education and simulation only. Not
          for clinical use.
        </div>
      </form>
    </div>
  );
}
