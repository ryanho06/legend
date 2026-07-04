import { Bookmark } from "lucide-react";
import type { ClinicalDocument, Encounter } from "../../types";

/**
 * The primary document opened when an encounter row is clicked: prefer a
 * report-kind file (e.g. the admission summary, an imaging report) over the
 * authored notes that share the encounter, otherwise the single matching note.
 * Returns null for event rows with no document.
 */
function resolvePrimary(
  encounter: Encounter,
  documents: ClinicalDocument[],
): ClinicalDocument | null {
  const matches = documents.filter((doc) => doc.encounterId === encounter.id);
  if (matches.length === 0) return null;
  return matches.find((doc) => doc.kind !== "note") ?? matches[0];
}

export function EncounterTable({
  encounters,
  documents,
  selectedDocId,
  onSelectDocument,
}: {
  encounters: Encounter[];
  documents: ClinicalDocument[];
  selectedDocId: string | null;
  onSelectDocument: (docId: string) => void;
}) {
  return (
    <div className="encounter-table-wrap">
      <table className="encounter-table">
        <thead>
          <tr>
            <th className="bookmark-col">
              <Bookmark size={12} />
            </th>
            <th>When</th>
            <th>Type</th>
            <th>Description</th>
            <th>Dep. Abbrev</th>
            <th>Specialty / Service</th>
            <th>Provider / Staff</th>
          </tr>
        </thead>

        <tbody>
          {encounters.flatMap((encounter, index) => {
            const rows = [];

            // Group rows for a bucket are contiguous, so a header is needed
            // wherever this row's bucket differs from the previous row's.
            if (encounter.group && encounter.group !== encounters[index - 1]?.group) {
              rows.push(
                <tr key={`group-${encounter.group}`} className="date-group-row">
                  <td colSpan={7}>{encounter.group}</td>
                </tr>,
              );
            }

            const primary = resolvePrimary(encounter, documents);
            const classes = [
              primary ? "linked-row" : "",
              primary && primary.id === selectedDocId ? "selected-row" : "",
            ]
              .filter(Boolean)
              .join(" ");

            rows.push(
              <tr
                key={encounter.id}
                className={classes || undefined}
                onClick={primary ? () => onSelectDocument(primary.id) : undefined}
              >
                <td className="bookmark-col">
                  <Bookmark size={12} className="bookmark-icon" />
                </td>
                <td className="enc-when">
                  {encounter.date}
                  {encounter.time ? ` ${encounter.time}` : ""}
                </td>
                <td className={encounter.admission ? "enc-type-admission" : undefined}>
                  {encounter.type}
                </td>
                <td>{encounter.description}</td>
                <td>{encounter.deptAbbrev}</td>
                <td>{encounter.specialty}</td>
                <td>{encounter.provider}</td>
              </tr>,
            );

            return rows;
          })}
        </tbody>
      </table>
    </div>
  );
}
