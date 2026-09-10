import { useState } from "react";
import { Dialog } from "../components/Dialog.jsx";
import { DialogFooter } from "../components/DialogFooter.jsx";

/**
 * JudgeAssignmentDialog — Alta de asignación con progressive disclosure
 * (Spec 027/E3, RF-UX-04). Noche y especialidad vienen del contexto del
 * board; "Suplente de…" solo aparece si elige Suplente. El contrato API
 * ({ nightId, specialtyId, judgeProfileId, assignmentType,
 * standbyForAssignmentId }) no cambia.
 */
export function JudgeAssignmentDialog({
  isOpen,
  onClose,
  onSubmit,
  nightName,
  specialtyName,
  judges = [],
  primaryOptions = [],
  submitting = false,
  focusReturnRef,
}) {
  const [assignmentType, setAssignmentType] = useState("PRIMARY");

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Asignar jurado"
      description={`${nightName} · ${specialtyName}`}
      focusReturnRef={focusReturnRef}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          onSubmit({
            judgeProfileId: values.get("judgeProfileId"),
            assignmentType: values.get("assignmentType"),
            standbyForAssignmentId: values.get("standbyForAssignmentId") || undefined,
          });
        }}
      >
        <p>
          Noche: <strong>{nightName}</strong> · Especialidad: <strong>{specialtyName}</strong>
        </p>
        <fieldset>
          <legend>Tipo de asignación</legend>
          <label>
            <input
              type="radio"
              name="assignmentType"
              value="PRIMARY"
              checked={assignmentType === "PRIMARY"}
              onChange={() => setAssignmentType("PRIMARY")}
            />{" "}
            Titular
          </label>
          <label>
            <input
              type="radio"
              name="assignmentType"
              value="SUBSTITUTE"
              checked={assignmentType === "SUBSTITUTE"}
              onChange={() => setAssignmentType("SUBSTITUTE")}
            />{" "}
            Suplente
          </label>
        </fieldset>
        <label htmlFor="assignment-judge">Jurado</label>
        <select id="assignment-judge" name="judgeProfileId" required defaultValue="">
          <option value="">Elegir jurado</option>
          {judges.map((judge) => (
            <option key={judge.id} value={judge.id}>
              {judge.name}
            </option>
          ))}
        </select>
        {assignmentType === "SUBSTITUTE" && (
          <>
            <label htmlFor="assignment-standby">Suplente de</label>
            <select id="assignment-standby" name="standbyForAssignmentId" required defaultValue="">
              <option value="">Elegir titular</option>
              {primaryOptions.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.judgeName} · {assignment.nightName} · {assignment.specialtyName}
                </option>
              ))}
            </select>
          </>
        )}
        <DialogFooter>
          <button type="button" className="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" disabled={submitting}>
            {submitting ? "Asignando…" : "Asignar"}
          </button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
