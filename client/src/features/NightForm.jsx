/**
 * NightForm — Alta/edición de jornada (Spec 027/C1, C1-clarificación).
 *
 * Solo presentación: `displayOrder` se muestra como "Orden de
 * visualización" y se autocompleta con max+1 (orden de creación).
 * El contrato API ({ name, displayOrder, kind, eventDate }) no cambia.
 */

const KIND_OPTIONS = [
  { value: "COMPETITION", label: "Competencia" },
  { value: "AWARDS", label: "Premiación" },
];

export function NightForm({
  initialValue = {},
  defaultOrder = 1,
  onSubmit,
  submitting = false,
  submitLabel = "Guardar jornada",
  idPrefix = "night",
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSubmit({
          name: data.get("name"),
          displayOrder: Number(data.get("displayOrder")),
          kind: data.get("kind"),
          eventDate: data.get("eventDate") || null,
        });
      }}
    >
      <label htmlFor={`${idPrefix}-name`}>Nombre de jornada</label>
      <input id={`${idPrefix}-name`} name="name" defaultValue={initialValue.name ?? ""} required />
      <label htmlFor={`${idPrefix}-order`}>Orden de visualización</label>
      <input
        id={`${idPrefix}-order`}
        name="displayOrder"
        type="number"
        min="1"
        defaultValue={initialValue.displayOrder ?? defaultOrder}
        required
      />
      <p className="help-text">Define el orden en listas y planillas. Se asigna por orden de creación.</p>
      <label htmlFor={`${idPrefix}-date`}>Fecha</label>
      <input
        id={`${idPrefix}-date`}
        name="eventDate"
        type="date"
        defaultValue={initialValue.eventDate?.slice?.(0, 10) ?? ""}
      />
      <label htmlFor={`${idPrefix}-kind`}>Tipo de jornada</label>
      <select id={`${idPrefix}-kind`} name="kind" defaultValue={initialValue.kind ?? "COMPETITION"}>
        {KIND_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button type="submit" disabled={submitting}>
        {submitting ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}

export const NIGHT_KIND_LABELS = Object.fromEntries(KIND_OPTIONS.map((option) => [option.value, option.label]));

export function nightKindLabel(kind, fallback = kind) {
  return NIGHT_KIND_LABELS[kind] ?? fallback;
}
