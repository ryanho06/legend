import { useCase } from "../../context/CaseContext";

export function VitalsTable() {
  const { vitalsTrend } = useCase().summary;
  return (
    <table className="summary-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>BP</th>
          <th>HR</th>
          <th>Resp</th>
          <th>SpO₂</th>
          <th>Temp °C</th>
        </tr>
      </thead>
      <tbody>
        {vitalsTrend.map((d) => (
          <tr key={d.t}>
            <td>{d.t}</td>
            <td>
              {d.sys}/{d.dia}
            </td>
            <td>{d.hr}</td>
            <td>{d.resp}</td>
            <td>{d.spo2}</td>
            <td>{d.tempC}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
