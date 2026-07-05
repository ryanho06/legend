import { useState } from "react";
import { LogIn } from "lucide-react";
import type { UserProfile } from "../types";

/**
 * Demo sign-in gate: captures the trainee's name so their notes are
 * attributed distinctly from the hardcoded case content. No auth — this is a
 * training mockup, the name only feeds display and note authorship.
 */
export function SignInPage({ onComplete }: { onComplete: (user: UserProfile) => void }) {
  const [forename, setForename] = useState("");
  const [surname, setSurname] = useState("");
  const ready = forename.trim().length > 0 && surname.trim().length > 0;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    onComplete({ forename: forename.trim(), surname: surname.trim() });
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

        <button className="signin-submit" type="submit" disabled={!ready}>
          <LogIn size={14} />
          Start training
        </button>

        <div className="signin-disclaimer">
          All patient data are synthetic. For education and simulation only. Not
          for clinical use.
        </div>
      </form>
    </div>
  );
}
