/**
 * CatalogForm — Alta/edición de tipos de participación y especialidades
 * (Spec 027/C3). `displayOrder` se presenta como "Orden de
 * visualización" con microcopy (decisión C1: orden de creación).
 * Contratos API intactos ({ name, displayOrder } / + { active }).
 */
export function CatalogForm({
  initialValue = {},
  defaultOrder = 1,
  onSubmit,
  submitting = false,
  submitLabel = "Guardar",
  showActive = false,
  idPrefix = "catalog",
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        onSubmit({
          name: formData.get("name"),
          displayOrder: Number(formData.get("displayOrder")),
          ...(showActive ? { active: formData.get("active") === "on" } : {}),
        });
      }}
    >
      <label htmlFor={`${idPrefix}-name`}>Nombre</label>
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
      <p className="help-text">Define el orden en listas y planillas. No cambia puntajes.</p>
      {showActive && (
        <label className="check">
          <input name="active" type="checkbox" defaultChecked={initialValue.active ?? true} /> Activa
        </label>
      )}
      <button type="submit" disabled={submitting}>
        {submitting ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}
