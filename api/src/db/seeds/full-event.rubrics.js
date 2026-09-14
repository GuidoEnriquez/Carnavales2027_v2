// Internal persistence helper for the single full-event seed.
// No event, troupe, ballot or vote is created from this module on its own.
export async function upsertRubric(client, eventId, specialties, entry, rubricType, evaluationTarget) {
  const { rows: [rubric] } = await client.query(
    `INSERT INTO rubric(event_id, name, code, evaluation_target, expected_subject_type, rubric_type, resolution_method, evaluation_objective)
     VALUES($1, $2, $3, $4, $5, $6, 'JURY', $7)
     ON CONFLICT (event_id, code) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [eventId, entry.name, entry.code, evaluationTarget,
      evaluationTarget === "NOMINATION" ? entry.expectedSubjectType : null,
      rubricType, entry.evaluationObjective ?? null],
  );
  const specialtyId = specialties.get(entry.specialty);
  if (!specialtyId) throw new Error(`SPECIALTY_NOT_FOUND:${entry.specialty}`);
  await client.query(
    `INSERT INTO evaluation_item(event_id, rubric_id, specialty_id, name, code, display_order, required, allow_not_presented)
     VALUES($1, $2, $3, $4, $5, 1, true, true)
     ON CONFLICT (rubric_id, code) DO UPDATE SET name = EXCLUDED.name`,
    [eventId, rubric.id, specialtyId, `${entry.name} — Evaluación integral`, `${entry.code}_ITEM`],
  );
  return rubric.id;
}
