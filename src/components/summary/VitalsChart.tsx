import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { VitalsPoint } from "../../types";
import { useCase } from "../../context/CaseContext";

const BP_COLOR = "#8e6fb8";

/** Single-value series sharing one Y axis; BP is drawn separately as a band. */
const SERIES = [
  { key: "hr", name: "Heart Rate", color: "#d6336c", unit: "" },
  { key: "resp", name: "Resp", color: "#7a8b3f", unit: "" },
  { key: "spo2", name: "SpO₂ (%)", color: "#16a0a0", unit: "%" },
  { key: "tempC", name: "Temp (°C)", color: "#3f4f9e", unit: "°C" },
] as const;

type VitalsRow = VitalsPoint & { bp: [number, number] };

/** Down triangle marker for systolic BP. */
function SysDot({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx == null || cy == null) return null;
  return <path d={`M${cx - 4},${cy - 4} L${cx + 4},${cy - 4} L${cx},${cy + 4} Z`} fill={BP_COLOR} />;
}

/** Up triangle marker for diastolic BP. */
function DiaDot({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx == null || cy == null) return null;
  return <path d={`M${cx - 4},${cy + 4} L${cx + 4},${cy + 4} L${cx},${cy - 4} Z`} fill={BP_COLOR} />;
}

/** BP collapses to one sys/dia line; the rest read straight off the row. */
function VitalsTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ payload: VitalsRow }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div className="vitals-tooltip">
      <div className="vitals-tooltip-time">{label}</div>
      <div>
        <span className="vitals-dot" style={{ background: BP_COLOR }} />
        BP {row.sys}/{row.dia} mmHg
      </div>
      {SERIES.map((s) => (
        <div key={s.key}>
          <span className="vitals-dot" style={{ background: s.color }} />
          {s.name.replace(/\s*\(.*\)$/, "")} {row[s.key]}
          {s.unit}
        </div>
      ))}
    </div>
  );
}

export function VitalsChart() {
  const { vitalsTrend } = useCase().summary;
  const data: VitalsRow[] = vitalsTrend.map((d) => ({ ...d, bp: [d.dia, d.sys] }));

  // Shared scale for every series, so the left and right axes read identically.
  const yValues = vitalsTrend.flatMap((d) => [d.sys, d.dia, d.hr, d.resp, d.spo2, d.tempC]);
  const yDomain: [number, number] = [Math.min(...yValues) - 8, Math.max(...yValues) + 14];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#e4e7d4" vertical={false} />
        <XAxis
          dataKey="t"
          tick={{ fontSize: 10, fill: "#888" }}
          tickLine={false}
          axisLine={{ stroke: "#cdd3b3" }}
        />
        <YAxis
          domain={yDomain}
          tick={{ fontSize: 10, fill: "#888" }}
          tickLine={false}
          axisLine={false}
          width={38}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={yDomain}
          tick={{ fontSize: 10, fill: "#888" }}
          tickLine={false}
          axisLine={false}
          width={30}
        />
        <Tooltip content={<VitalsTooltip />} isAnimationActive={false} />

        <Area
          dataKey="bp"
          name="BP (mmHg)"
          stroke="none"
          fill={BP_COLOR}
          fillOpacity={0.18}
          legendType="circle"
          isAnimationActive={false}
        />
        <Line
          dataKey="sys"
          name="BP sys"
          stroke="none"
          dot={<SysDot />}
          activeDot={false}
          legendType="none"
          isAnimationActive={false}
        />
        <Line
          dataKey="dia"
          name="BP dia"
          stroke="none"
          dot={<DiaDot />}
          activeDot={false}
          legendType="none"
          isAnimationActive={false}
        />

        {SERIES.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 2 }}
            isAnimationActive={false}
          />
        ))}

        {/* Invisible series anchoring the right axis so its ticks render and
            mirror the left (Recharts drops an axis with no series on it). */}
        <Line
          yAxisId="right"
          dataKey="hr"
          stroke="none"
          dot={false}
          activeDot={false}
          legendType="none"
          isAnimationActive={false}
        />

        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          iconSize={9}
          wrapperStyle={{ fontSize: 11, paddingLeft: 16 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
