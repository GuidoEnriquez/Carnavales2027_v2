// Guard de `npm test` / `npm run db:test`.
//
// Cada archivo de test usa `{ skip: !process.env.TEST_DATABASE_URL }` para no
// romper si alguien ejecuta un archivo suelto sin base de pruebas configurada.
// Ese mismo patrón, a nivel de suite completa, hace que `npm test` reporte
// "0 fallos" aunque TEST_DATABASE_URL nunca estuvo definida: una corrida verde
// no implica que algo se haya ejecutado. Este guard corre como `pretest` /
// `predb:test` y falla fuerte, antes de que el test runner arranque, si falta
// la variable — así el punto de entrada estándar (y por lo tanto CI) nunca
// puede reportar éxito sin cobertura real.
if (!process.env.TEST_DATABASE_URL) {
  console.error(
    "TEST_DATABASE_URL no está definida.\n" +
      "npm test / npm run db:test requieren una base de pruebas aislada " +
      "(ver api/.env.example). Si tu intención es ejecutar un único archivo " +
      "de test sin base de datos, invocá node --test directamente sobre ese " +
      "archivo en vez de usar estos scripts.",
  );
  process.exit(1);
}
