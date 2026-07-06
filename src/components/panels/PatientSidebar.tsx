import { UserRound } from "lucide-react";
import { useCase } from "../../context/CaseContext";

export function PatientSidebar() {
  const { patient } = useCase();
  return (
    <aside className="patient-sidebar">
      <div className="patient-avatar">{patient.initials}</div>

      <h2>{patient.displayName}</h2>
      <div className="patient-subtitle">
        {patient.sex}, {patient.age} / {patient.dob}
      </div>
      <div className="patient-subtitle">MRN: {patient.mrn}</div>

      <div className="sidebar-rows">
        <SideInfo label="Location" value={patient.location} />
        <SideInfo label="Service" value={patient.specialty} />
        <SideInfo label="Code" value={patient.code} />
        <SideInfo label="Isolation" value={patient.isolation} />
      </div>

      <Provider physician={patient.attending} role="Primary Consultant" />
      <Provider physician={patient.primaryCare} role="Primary Care (GP)" />

      <div className="sidebar-allergy">
        <span className="sidebar-allergy-label">Allergies</span>
        <span className="sidebar-allergy-value">{patient.allergies}</span>
      </div>
    </aside>
  );
}

function SideInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="side-info">
      <span className="side-label">{label}:</span>
      <span className="side-value">{value}</span>
    </div>
  );
}

function Provider({
  physician,
  role,
}: {
  physician: {
    forename: string;
    surname: string;
    credential: string;
    specialty: string;
  };
  role: string;
}) {
  return (
    <div className="provider-block">
      <div className="provider-avatar">
        <UserRound size={17} />
      </div>
      <div>
        <div className="provider-name">
          {physician.surname.toUpperCase()}, {physician.forename}, {physician.credential}
        </div>
        <div className="provider-role">
          {role} · {physician.specialty}
        </div>
      </div>
    </div>
  );
}
