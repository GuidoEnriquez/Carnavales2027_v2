/**
 * RubricTree — Vista de lectura de la jerarquía de evaluación
 * (Spec 027/D1, RF-UX-05):
 *
 *   Especialidad → Rubro → Ítems puntuables → Criterios
 *
 * Deriva de los mismos datos del editor; no escribe. El administrador
 * ve qué puntúa el jurado y qué criterios observa para ese puntaje.
 */
export function RubricTree({ rubrics = [], specialties = [] }) {
  const activeSpecialties = specialties.filter((s) => s.active !== false);
  const activeRubrics = rubrics.filter((r) => r.active !== false);

  if (activeSpecialties.length === 0) {
    return <p className="empty-state">Todavía no hay especialidades activas.</p>;
  }

  return (
    <div className="rubric-tree" aria-label="Árbol de evaluación por especialidad">
      {activeSpecialties.map((specialty) => {
        const rubricsForSpecialty = activeRubrics
          .map((rubric) => ({
            rubric,
            items: [...(rubric.items ?? [])]
              .filter((item) => item.active !== false && item.specialtyId === specialty.id)
              .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
          }))
          .filter(({ items }) => items.length > 0);
        return (
          <article key={specialty.id} className="rubric-tree-specialty">
            <h4>{specialty.name}</h4>
            {rubricsForSpecialty.length === 0 ? (
              <p className="rubric-tree-empty">Sin rubros asignados a esta especialidad.</p>
            ) : (
              <ul className="rubric-tree-rubrics">
                {rubricsForSpecialty.map(({ rubric, items }) => (
                  <li key={rubric.id}>
                    <strong>{rubric.name}</strong>
                    <ul className="rubric-tree-items">
                      {items.map((item) => {
                        const criteria = [...(rubric.criteria ?? [])]
                          .filter((c) => c.scoringItemId === item.id && c.active !== false)
                          .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
                        return (
                          <li key={item.id}>
                            <span>{item.name}</span>
                            {criteria.length > 0 && (
                              <ul className="rubric-tree-criteria">
                                {criteria.map((criterion) => (
                                  <li key={criterion.id}>{criterion.description}</li>
                                ))}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </article>
        );
      })}
    </div>
  );
}
