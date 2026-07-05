import { Smartphone } from "lucide-react";

/**
 * Full-screen prompt shown (via CSS media query) only on narrow portrait
 * viewports, where the fixed patient sidebar would swallow the workspace.
 * Rotating to landscape or widening the window dismisses it automatically.
 */
export function RotateGate() {
  return (
    <div className="rotate-gate">
      <div className="rotate-gate-card">
        <Smartphone className="rotate-gate-icon" size={40} />
        <div className="rotate-gate-brand">
          <span className="brand-logo">L</span>
          <span>LegendCare</span>
        </div>
        <p>
          Legend recreates a desktop EHR, so it needs a wide screen. Rotate
          your phone sideways, or open this page on a laptop.
        </p>
      </div>
    </div>
  );
}
