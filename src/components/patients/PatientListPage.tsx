import { useState } from "react";
import { ClipboardList, FolderOpen, Search } from "lucide-react";
import { caseRegistry, listSpecialties } from "../../data/patients";
import { gradeLabel, gradeRank } from "../../lib/grades";

/**
 * Full-screen Patient Lists activity (the Epic patient-list view, sim-sized):
 * specialty lists on the left, the selected list's patients in a table. A
 * single click opens the chart. Shown after sign-in and whenever no chart tab
 * is open; the top-bar hamburger returns here.
 */
export function PatientListPage({
  openIds,
  onOpen,
}: {
  /** Cases that already have a chart tab open (marked in the table). */
  openIds: string[];
  onOpen: (caseId: string) => void;
}) {
  const specialties = listSpecialties();
  const [selected, setSelected] = useState(specialties[0] ?? "");
  const rows = caseRegistry
    .filter((c) => c.specialty === selected)
    .slice()
    .sort((a, b) => gradeRank(a.rubric.task.minGrade) - gradeRank(b.rubric.task.minGrade));

  return (
    <div className="patient-list-page">
      <div className="patient-list-rail">
        <div className="patient-list-rail-title">My Lists</div>
        {specialties.map((specialty) => {
          const count = caseRegistry.filter((c) => c.specialty === specialty).length;
          return (
            <button
              key={specialty}
              className={
                specialty === selected
                  ? "patient-list-item active"
                  : "patient-list-item"
              }
              onClick={() => setSelected(specialty)}
            >
              <ClipboardList size={13} />
              <span className="patient-list-item-name">{specialty}</span>
              <span className="patient-list-item-count">{count}</span>
            </button>
          );
        })}
        <div className="patient-list-rail-note">
          More specialty lists appear as cases are added.
        </div>
      </div>

      <div className="patient-list-main">
        <div className="patient-list-head">
          <h1>Patient Lists</h1>
          <span className="patient-list-sub">
            {selected} · {rows.length} patient{rows.length === 1 ? "" : "s"}
          </span>
          <div className="toolbar-spacer" />
          <div className="patient-list-search">
            <Search size={13} />
            <span>Search Current Locations</span>
          </div>
        </div>

        <table className="patient-list-table">
          {/* Fixed layout + explicit widths so columns don't reflow when
              switching lists (only Handoff flexes). */}
          <colgroup>
            <col style={{ width: 90 }} />
            <col style={{ width: 190 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 80 }} />
            <col />
            <col style={{ width: 300 }} />
          </colgroup>
          <thead>
            <tr>
              <th>Bed</th>
              <th>Patient Name</th>
              <th>MRN</th>
              <th>Sex / Age</th>
              <th>Handoff — Summary</th>
              <th>Hierarchy</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} onClick={() => onOpen(c.id)}>
                <td>{c.patient.location}</td>
                <td className="patient-list-name">
                  {c.patient.displayName}
                  {openIds.includes(c.id) && (
                    <span className="patient-list-open-tag">
                      <FolderOpen size={11} /> Open
                    </span>
                  )}
                </td>
                <td>{c.patient.mrn}</td>
                <td>
                  {c.patient.sex}, {c.patient.age}
                </td>
                <td className="patient-list-handoff">{c.handoff}</td>
                <td className="patient-list-hierarchy">
                  <span className={`task-badge task-${c.rubric.task.code}`}>
                    {c.rubric.task.code.toUpperCase()}
                  </span>
                  <span className="task-label">{c.rubric.task.label}</span>
                  <span className="task-grade">{gradeLabel(c.rubric.task.minGrade)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="patient-list-footer">
          All patient data are synthetic. For education and simulation only. Not
          for clinical use.
        </div>
      </div>
    </div>
  );
}
