import { useState } from "react";
import { ClipboardList, FolderOpen, Search } from "lucide-react";
import { caseRegistry, listSpecialties } from "../../data/patients";

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
  const rows = caseRegistry.filter((c) => c.specialty === selected);

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
          <thead>
            <tr>
              <th>Bed</th>
              <th>Patient Name</th>
              <th>MRN</th>
              <th>Sex / Age</th>
              <th>Handoff — Summary</th>
              <th>Service</th>
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
                <td>{c.patient.specialty}</td>
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
