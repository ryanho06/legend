import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { X } from "lucide-react";
import { useCase } from "../context/CaseContext";
import { usePersistentState } from "../hooks/usePersistentState";

const LAYOUT_KEY = "legend.sticky.layout";
const DEFAULT_WIDTH = 340;
const DEFAULT_HEIGHT = 240;

type StickyLayout = { x: number; y: number; w: number; h: number };

/** Keep the popup fully reachable inside the current viewport. */
function clampToViewport(layout: StickyLayout): StickyLayout {
  const w = Math.min(layout.w, window.innerWidth);
  const h = Math.min(layout.h, window.innerHeight);
  return {
    w,
    h,
    x: Math.min(Math.max(0, layout.x), Math.max(0, window.innerWidth - w)),
    y: Math.min(Math.max(0, layout.y), Math.max(0, window.innerHeight - h)),
  };
}

function loadLayout(): StickyLayout {
  try {
    const raw = window.localStorage.getItem(LAYOUT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StickyLayout;
      if ([parsed.x, parsed.y, parsed.w, parsed.h].every(Number.isFinite)) {
        return clampToViewport(parsed);
      }
    }
  } catch {
    // Corrupt stored JSON — fall through to the default placement.
  }
  return clampToViewport({
    x: window.innerWidth - DEFAULT_WIDTH - 60,
    y: 96,
    w: DEFAULT_WIDTH,
    h: DEFAULT_HEIGHT,
  });
}

function saveLayout(layout: StickyLayout) {
  window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
}

export function StickyNotePopup({ onClose }: { onClose: () => void }) {
  const { patient } = useCase();
  const [text, setText] = usePersistentState(
    `legend.sticky.${patient.mrn}`,
    patient.stickyNote,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState(loadLayout);
  // Mirror for event handlers that must read the latest layout without
  // re-subscribing (drag-end save, ResizeObserver).
  const layoutRef = useRef(layout);
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);

  useLayoutEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const onPointerMove = useCallback((event: PointerEvent) => {
    const offset = dragOffset.current;
    if (!offset) return;
    setLayout((prev) => ({
      ...prev,
      x: event.clientX - offset.dx,
      y: event.clientY - offset.dy,
    }));
  }, []);

  const stopDragging = useCallback(
    function stopDragging() {
      if (dragOffset.current) saveLayout(layoutRef.current);
      dragOffset.current = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDragging);
    },
    [onPointerMove],
  );

  const startDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Don't start a drag when the close button is pressed.
    if ((event.target as HTMLElement).closest("button")) return;
    dragOffset.current = {
      dx: event.clientX - layoutRef.current.x,
      dy: event.clientY - layoutRef.current.y,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
  };

  useEffect(() => stopDragging, [stopDragging]);

  // Capture CSS `resize: both` drags and persist the new size.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w === layoutRef.current.w && h === layoutRef.current.h) return;
      const next = { ...layoutRef.current, w, h };
      layoutRef.current = next;
      setLayout(next);
      saveLayout(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      className="sticky-popup"
      style={{ left: layout.x, top: layout.y, width: layout.w, height: layout.h }}
    >
      <div className="sticky-title" onPointerDown={startDragging}>
        <span>My Sticky Note</span>
        <div className="sticky-actions">
          <button title="Close" onClick={onClose}>
            <X size={13} />
          </button>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Write a private note for yourself..."
      />
    </div>
  );
}
