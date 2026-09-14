import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("seed:event:full es el único seed público del proyecto", async () => {
  const { scripts } = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(scripts).filter((name) => name.includes("seed")), ["seed:event:full"]);
  assert.equal(scripts["seed:event:full"], "node src/scripts/seed-full-event.js");
  const cli = await readdir(new URL("../scripts/", import.meta.url));
  assert.deepEqual(cli.filter((name) => name.startsWith("seed-") && name.endsWith(".js")), ["seed-full-event.js"]);
  const db = await readdir(new URL("../db/", import.meta.url));
  assert.ok(!db.includes("seed.js"));
  const seedModules = await readdir(new URL("../db/seeds/", import.meta.url));
  assert.ok(seedModules.every((name) => name.startsWith("full-event.") && name.endsWith(".js")));
});
