// Catálogo reglamentario Carnaval 2027 — datos puros, sin acceso a BD.
//
// Origen: pedido de seed de rubros reales (25 nominativos + 11 aleatorios).
// Fuentes SDD vigentes: Spec 010 (solo NOMINATIVE integra Mejor Comparsa),
// Spec 017 (rubric_type, evaluation_target, expected_subject_type, matriz
// rubro-especialidad derivada de los ítems), Spec 004 (PENDING bloquea,
// escala 1-10, 0 solo vía NOT_PRESENTED) y decisión de producto 2026-09-01
// ("5 por equidad" nulo: este catálogo NO define defaultScore).
//
// ADVERTENCIAS:
// - La columna `specialty` por ítem es una HEURÍSTICA DE TESTING. Cada
//   evaluation_item exige exactamente una especialidad (BAILE/VESTUARIO/
//   BATERIA) por restricción del modelo, pero el reglamento no asigna un
//   rubro completo a una única especialidad. La asignación real la define
//   la planilla oficial cuando exista; estos valores son editables desde
//   Competencia (evento en CONFIGURING).
// - `expectedSubjectType` de los rubros RANDOM es un valor inicial de
//   testing exigido por el modelo (NOMINATION requiere sujeto); no es
//   una regla reglamentaria.
// - Los números 25/11/36/7 son datos del fixture, nunca reglas de negocio.
//   El frontend NO debe asumirlos: todo proviene de API/BD.

export const NOMINATIVE_RUBRICS = [
  { code: "REINA_COMPARSA", name: "Reina de Comparsa", order: 1, specialty: "VESTUARIO" },
  { code: "REINA_INFANTIL_COMPARSA", name: "Reina Infantil de Comparsa", order: 2, specialty: "VESTUARIO" },
  { code: "ANUNCIADOR_COMPARSA", name: "Anunciador/a de Comparsa", order: 3, specialty: "BAILE" },
  { code: "ANUNCIADOR_INFANTIL", name: "Anunciador/a Infantil", order: 4, specialty: "BAILE" },
  { code: "COMISION_FRENTE", name: "Comisión de Frente", order: 5, specialty: "BAILE" },
  { code: "BASTONERA_MAYOR", name: "Bastonera Mayor", order: 6, specialty: "BAILE" },
  { code: "BASTONERA_MAYOR_INFANTIL", name: "Bastonera Mayor Infantil", order: 7, specialty: "BAILE" },
  { code: "EMBAJADOR_COMPARSA", name: "Embajador/a de Comparsa", order: 8, specialty: "BAILE" },
  { code: "EMBAJADOR_INFANTIL_COMPARSA", name: "Embajador/a Infantil de Comparsa", order: 9, specialty: "BAILE" },
  { code: "PORTAESTANDARTE_MAYOR", name: "Porta Estandarte Mayor", order: 10, specialty: "VESTUARIO" },
  { code: "CORDONEROS_COMPARSA", name: "Cordoneros/as de Comparsa", order: 11, specialty: "VESTUARIO" },
  { code: "MAESTRO_SALA_PORTABANDERA", name: "Maestro de Sala y Porta Bandera de Institución", order: 12, specialty: "BAILE" },
  { code: "GRUPO_PASISTAS", name: "Mejor Grupo de Pasistas", order: 13, specialty: "BAILE" },
  { code: "CARRO_DESTAQUE_ALEGORICO", name: "Carro Destaque o Alegórico", order: 14, specialty: "VESTUARIO" },
  { code: "PORTAESTANDARTE_BATERIA", name: "Portaestandarte de Batería", order: 15, specialty: "BATERIA" },
  { code: "CORDONEROS_BATERIA", name: "Cordoneros/as de Batería", order: 16, specialty: "BATERIA" },
  { code: "COMISION_FONDO_BATERIA", name: "Comisión de Fondo o Ala Pasistas de Batería", order: 17, specialty: "BAILE" },
  { code: "REINA_BASTONERA_BATERIA", name: "Reina o Bastonera de Batería", order: 18, specialty: "BAILE" },
  { code: "BATERIA_COMPARSA", name: "Mejor Batería de Comparsa", order: 19, specialty: "BATERIA" },
  { code: "CARROZA_REINA", name: "Carroza de Reina", order: 20, specialty: "VESTUARIO" },
  { code: "COREOGRAFIA_COMPARSA", name: "Mejor Coreografía de Comparsa", order: 21, specialty: "BAILE" },
  { code: "TEMA_INEDITO", name: "Mejor Tema Inédito", order: 22, specialty: "BATERIA" },
  { code: "PRESENTADOR_COMPARSA", name: "Mejor Presentador/a de Comparsa", order: 23, specialty: "BAILE" },
  { code: "DISENO_INTERPRETACION", name: "Diseño e Interpretación", order: 24, specialty: "VESTUARIO" },
  // El reglamento supedita su evaluación a presentación/aprobación COC.
  // El modelo no tiene columna metadata: se deja ACTIVE con la nota en
  // evaluation_objective (solo informativa, sin efecto operativo).
  {
    code: "GRUPO_MUSICAL_VIVO",
    name: "Mejor Grupo Musical en Vivo",
    order: 25,
    specialty: "BATERIA",
    evaluationObjective: "Requiere validación COC de presentación/aprobación (nota informativa de testing, sin efecto operativo).",
  },
];

export const RANDOM_RUBRICS = [
  { code: "REINA_CARNAVAL", name: "Reina del Carnaval", order: 1, specialty: "VESTUARIO", expectedSubjectType: "PERSON" },
  { code: "PRIMERA_PRINCESA", name: "Primera Princesa", order: 2, specialty: "VESTUARIO", expectedSubjectType: "PERSON" },
  { code: "SEGUNDA_PRINCESA", name: "Segunda Princesa", order: 3, specialty: "VESTUARIO", expectedSubjectType: "PERSON" },
  { code: "EMBAJADORES_INFANTILES_CARNAVAL", name: "Embajador y Embajadora Infantil del Carnaval", order: 4, specialty: "VESTUARIO", expectedSubjectType: "COUPLE" },
  { code: "REY_CARNAVAL", name: "Rey del Carnaval", order: 5, specialty: "VESTUARIO", expectedSubjectType: "PERSON" },
  { code: "ESPIRITU_CARNAVAL", name: "Espíritu del Carnaval", order: 6, specialty: "BAILE", expectedSubjectType: "GROUP" },
  { code: "TRAJE_FEMENINO", name: "Traje Femenino", order: 7, specialty: "VESTUARIO", expectedSubjectType: "FIGURE" },
  { code: "TRAJE_MASCULINO", name: "Traje Masculino", order: 8, specialty: "VESTUARIO", expectedSubjectType: "FIGURE" },
  { code: "MEJOR_BAILARINA", name: "Mejor Bailarina", order: 9, specialty: "BAILE", expectedSubjectType: "PERSON" },
  { code: "MEJOR_BAILARIN", name: "Mejor Bailarín", order: 10, specialty: "BAILE", expectedSubjectType: "PERSON" },
  { code: "MEJOR_PAREJA_BAILE", name: "Mejor Pareja de Baile", order: 11, specialty: "BAILE", expectedSubjectType: "COUPLE" },
];

// Referencia descriptiva de la escala reglamentaria (documental: el modelo
// no tiene tabla de etiquetas y TODOS los valores 1..10 siguen válidos).
// PENDING = score NULL. NOT_PRESENTED = score 0 por acción explícita.
// SCORED = score 1..10. PENDING nunca es 0. No existe defaultScore = 5.
export const SCALE_REFERENCE = {
  1: "Reconocimiento al esfuerzo",
  6: "Regular",
  7: "Bueno",
  8: "Muy bueno",
  9: "Distinguido",
  10: "Sobresaliente / destaca la excelencia",
};
