import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedFullCarnivalEvent } from "../db/seeds/full-event.js";
import { closePool } from "../db/pool.js";

export function printFullEventSummary(result, log = console.log) {
  log("====================================================");
  log(" CARNAVALES 2027 - FULL EVENT TEST SEED");
  log("====================================================");
  log(`✓ Evento: ${result.name}`);
  log(`✓ Jornadas: ${result.nights.length} configuradas (DRAFT)`);
  log(`✓ Comparsas: ${result.troupes} configuradas`);
  log(`✓ Rubros: ${result.nominative} nominativos / ${result.random} aleatorios / ${result.rubrics} total`);
  log(`✓ Jurados: ${result.jurors} configurados`);
  for (const night of result.nights) {
    log(`✓ ${night.code} (${night.date}): ${night.jurors} asignaciones / ${night.participations} posiciones`);
  }
  log(`✓ Participaciones y órdenes de pasada: ${result.participations}`);
  log(`✓ Cobertura comparsa/rubro nominativo: ${result.coverage} (implícita)`);
  log(`✓ Planillas: ${result.ballots} iniciales; ${result.ballotsOnOpeningAllNights} al abrir las tres jornadas`);
  log(`✓ Votos emitidos: ${result.votes}`);
  log(`✓ Penalizaciones aplicadas: ${result.penalties}`);
  log(`✓ ADMIN: ${result.users.admin.email}`);
  for (const user of result.users.judges) log(`✓ JUDGE: ${user.email}`);
  for (const user of result.users.auxiliaries) log(`✓ ${user.role}: ${user.email}`);
  log("✓ Evento listo para comenzar (CONFIGURING; readiness válido)");
  log("Horarios y sorteo simulados; no oficiales COC. Operación online.");
  log("====================================================");
}

async function main() {
  try { printFullEventSummary(await seedFullCarnivalEvent()); }
  catch (error) { console.error(`Full event seed falló: ${error.message}`); process.exitCode = 1; }
  finally { await closePool(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
