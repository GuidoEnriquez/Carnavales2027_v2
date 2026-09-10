import { useState } from "react";

/**
 * TroupeForm — Alta/edición de comparsa (Spec 027/C2).
 *
 * Mismo contrato API ({ name, categoryId, brandColor, active }).
 * El color se valida como #RRGGBB o vacío; visible en admin (swatch)
 * y en planilla del jurado (decisión C3: ambos).
 */
export function TroupeForm({
  initialValue = {},
  categories = [],
  onSubmit,
  submitting = false,
  submitLabel = "Guardar comparsa",
  showActive = false,
  idPrefix = "troupe",
}) {
  const [fieldError, setFieldError] = useState("");

  const readBrandColor = (formData) => {
    const raw = (formData.get("brandColor") ?? "").toString().trim();
    if (raw === "") return null;
    if (!/^#[0-9A-Fa-f]{6}$/.test(raw)) {
      setFieldError("El color debe tener formato #RRGGBB (por ejemplo #3B82F6). Dejalo vacio para no asignar color.");
      return undefined;
    }
    return raw;
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const brandColor = readBrandColor(formData);
        if (brandColor === undefined) return;
        setFieldError("");
        onSubmit({
          name: formData.get("name"),
          categoryId: formData.get("categoryId"),
          brandColor,
          ...(showActive ? { active: formData.get("active") === "on" } : {}),
        });
      }}
    >
      <label htmlFor={`${idPrefix}-name`}>Nombre</label>
      <input id={`${idPrefix}-name`} name="name" defaultValue={initialValue.name ?? ""} required />
      <label htmlFor={`${idPrefix}-category`}>Tipo de participación</label>
      <select id={`${idPrefix}-category`} name="categoryId" defaultValue={initialValue.categoryId ?? ""} required>
        <option value="">Seleccionar</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <label htmlFor={`${idPrefix}-color`}>Color (opcional)</label>
      <input
        id={`${idPrefix}-color`}
        name="brandColor"
        placeholder="#3B82F6"
        aria-describedby={`${idPrefix}-color-help`}
        defaultValue={initialValue.brandColor ?? ""}
      />
      <p id={`${idPrefix}-color-help`} className="help-text">
        Color en formato #RRGGBB. Vacio = sin color. Solo vista: no cambia puntajes ni resultados.
      </p>
      {fieldError && <p className="field-error" role="alert">{fieldError}</p>}
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
