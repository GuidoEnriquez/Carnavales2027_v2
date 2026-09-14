import { NOMINATIVE_RUBRICS, RANDOM_RUBRICS } from "./full-event.catalog.js";

// FICTIONAL TEST DATA. No date, person or draw below is official COC data.
export const FULL_EVENT = {
  seedKey: "carnavales-goya-2027-integral-test",
  name: "Carnavales Goyanos 2027 - Evento Integral TEST",
  year: 2027,
  timezone: "America/Argentina/Cordoba",
  firstPass: "20:30:00",
  utcOffset: "-03:00", // Offset for the fictional February 2027 dates below.
  intervalMinutes: 90,
  orderSource: "TEST_SIMULATED_DRAW",
  metadata: {
    seed: true, fixture: "FULL_EVENT", fixtureVersion: "2027.2", officialData: false,
    orderType: "SIMULATED_DRAW", description: "Fixture integral para pruebas funcionales de Carnavales 2027",
  },
};
export const FULL_NIGHTS = [
  { code: "J1", name: "Primera Jornada Puntuable", order: 1, date: "2027-02-06" },
  { code: "J2", name: "Segunda Jornada Puntuable", order: 2, date: "2027-02-07" },
  { code: "J3", name: "Tercera Jornada Puntuable", order: 3, date: "2027-02-13" },
];
export const FULL_TROUPES = [
  { code: "TEST-ARA", name: "Ará Porá" },
  { code: "TEST-IMP", name: "Imperio del Sur" },
  { code: "TEST-YAS", name: "Yasí Berá" },
  { code: "TEST-SAM", name: "Samba del Paraná" },
  { code: "TEST-FEN", name: "Fénix" },
  { code: "TEST-ALG", name: "Alma Guaraní" },
  { code: "TEST-BRI", name: "Brillo de Carnaval" },
];
export const FULL_CATEGORY = { code: "PRIMERA", name: "Primera categoría", order: 1 };
export const FULL_SPECIALTIES = [
  { code: "BAILE", name: "Baile", order: 1 },
  { code: "VESTUARIO", name: "Vestuario", order: 2 },
  { code: "BATERIA", name: "Batería", order: 3 },
];
const JURY_NAMES = [
  ["Martín Salvatierra", "Carolina Benítez", "Federico Acosta"],
  ["Luciana Ferreyra", "Alejandro Ramírez", "Mariana Duarte"],
  ["Sebastián Molina", "Valeria Romero", "Diego Cáceres"],
];
export const FULL_JUDGES = FULL_NIGHTS.flatMap((night, nightIndex) => FULL_SPECIALTIES.map((specialty, specialtyIndex) => {
  const code = `JURY-${specialty.code}-${String(night.order).padStart(2, "0")}`;
  return {
    code, name: JURY_NAMES[nightIndex][specialtyIndex], email: `${code.toLowerCase()}@example.test`,
    documentNumber: String(71000001 + nightIndex * FULL_SPECIALTIES.length + specialtyIndex),
    nightCode: night.code, specialtyCode: specialty.code,
  };
}));
export const FULL_AUXILIARIES = [
  { name: "Escribano Escrutinio Demo", email: "demo.escrutinio@carnaval.local", documentNumber: "70000004", role: "ESCRIBANO" },
  { name: "Veedor Integral Ficticio", email: "demo.veedor.integral@example.test", documentNumber: "71000100", role: "VEEDOR" },
];
export const FULL_RUBRICS = [
  ...NOMINATIVE_RUBRICS.map((entry) => ({ ...entry, type: "NOMINATIVE", target: "TROUPE" })),
  ...RANDOM_RUBRICS.map((entry) => ({ ...entry, type: "RANDOM", target: "NOMINATION" })),
];

export function fullScheduleForNight(night) {
  const shift = (night.order - 1) % FULL_TROUPES.length;
  const troupes = shift ? [...FULL_TROUPES.slice(-shift), ...FULL_TROUPES.slice(0, -shift)] : FULL_TROUPES;
  const start = Date.parse(`${night.date}T${FULL_EVENT.firstPass}${FULL_EVENT.utcOffset}`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: FULL_EVENT.timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(start)).map(({ type, value }) => [type, value]));
  if (`${parts.year}-${parts.month}-${parts.day}` !== night.date
    || `${parts.hour}:${parts.minute}:${parts.second}` !== FULL_EVENT.firstPass) {
    throw new Error("FULL_FIXTURE_TIMEZONE_OFFSET_MISMATCH");
  }
  return troupes.map((troupe, index) => ({
    troupeCode: troupe.code, troupeName: troupe.name, position: index + 1,
    scheduledAt: new Date(start + index * FULL_EVENT.intervalMinutes * 60_000).toISOString(),
  }));
}
