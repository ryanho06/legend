import { useRef, useState } from "react";
import { X } from "lucide-react";

export type PatientTab = { id: string; label: string };

/**
 * Epic-style open-chart tabs, directly below the top system bar. Same
 * browser-tab ergonomics as the note preview tabs: equal-width tabs shrink as
 * more open, and closing one freezes the current width so the next close
 * button lands under the cursor until the pointer leaves the bar.
 */
export function PatientTabBar({
  tabs,
  activeId,
  onSelect,
  onClose,
}: {
  tabs: PatientTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [frozenWidth, setFrozenWidth] = useState<number | null>(null);

  function close(id: string) {
    const firstTab = barRef.current?.querySelector(".patient-tab");
    setFrozenWidth(
      firstTab && tabs.length > 1 ? firstTab.getBoundingClientRect().width : null,
    );
    onClose(id);
  }

  if (tabs.length === 0) return null;

  return (
    <div
      className="patient-tabbar"
      role="tablist"
      aria-label="Open charts"
      ref={barRef}
      onMouseLeave={() => setFrozenWidth(null)}
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={tab.id === activeId ? "patient-tab active" : "patient-tab"}
          style={
            frozenWidth != null
              ? { flex: "none", width: frozenWidth, maxWidth: "none" }
              : undefined
          }
        >
          <button
            role="tab"
            aria-selected={tab.id === activeId}
            className="patient-tab-label"
            onClick={() => onSelect(tab.id)}
          >
            {tab.label}
          </button>
          <button
            className="patient-tab-close"
            aria-label={`Close ${tab.label}`}
            onClick={() => close(tab.id)}
          >
            <X size={11} />
          </button>
        </div>
      ))}
    </div>
  );
}
