import assert from "node:assert/strict";
import test from "node:test";
import {
  createEventScope,
  discardEventScope,
  emitMonitorEvent,
  flushEventScope,
  resetMonitorEventBus,
  runInEventScope,
  sanitizeMonitorEvent,
  subscribeMonitorEvents,
} from "../modules/monitor/monitor-event-bus.js";

function collectEvents() {
  const received = [];
  subscribeMonitorEvents((event) => received.push(event));
  return received;
}

test("fuera de transacción los eventos se difunden de inmediato", () => {
  const received = collectEvents();
  const emitted = emitMonitorEvent("RESULTS_SNAPSHOT_UPDATED", { eventId: "ev-1", version: 1 });
  assert.equal(emitted.type, "RESULTS_SNAPSHOT_UPDATED");
  assert.equal(received.length, 1);
  assert.equal(received[0].eventId, "ev-1");
});

test("dentro de un scope los eventos se encolan y el COMMIT los difunde en orden", async () => {
  const received = collectEvents();
  const store = createEventScope();
  await runInEventScope(store, async () => {
    emitMonitorEvent("RESULTS_RELEASED", { eventId: "ev-1" });
    await Promise.resolve();
    emitMonitorEvent("RESULTS_SNAPSHOT_UPDATED", { eventId: "ev-1", version: 1 });
  });
  assert.equal(received.length, 0, "nada debe difundirse antes del COMMIT");
  flushEventScope(store);
  assert.deepEqual(
    received.map((e) => e.type),
    ["RESULTS_RELEASED", "RESULTS_SNAPSHOT_UPDATED"],
    "el flush debe preservar el orden de emisión",
  );
});

test("el ROLLBACK descarta los eventos encolados sin difundir nada", async () => {
  const received = collectEvents();
  const store = createEventScope();
  await runInEventScope(store, async () => {
    emitMonitorEvent("RESULTS_SNAPSHOT_UPDATED", { eventId: "ev-1", version: 1 });
  });
  discardEventScope(store);
  assert.equal(received.length, 0, "un rollback no puede notificar una operación no persistida");
});

test("opción immediate difunde al instante aunque haya transacción activa", async () => {
  const received = collectEvents();
  const store = createEventScope();
  await runInEventScope(store, async () => {
    emitMonitorEvent("CLOSE_ATTEMPT_INCOMPLETE", { eventId: "ev-1", nightId: "n-1", pendingCount: 3 }, { immediate: true });
    emitMonitorEvent("RESULTS_SNAPSHOT_UPDATED", { eventId: "ev-1", version: 1 });
  });
  assert.deepEqual(
    received.map((e) => e.type),
    ["CLOSE_ATTEMPT_INCOMPLETE"],
    "el evento immediate llega aunque la transacción siga abierta",
  );
  discardEventScope(store);
});

test("runInEventScope reutiliza un scope externo y no genera difusión intermedia", async () => {
  const received = collectEvents();
  const outer = createEventScope();
  await runInEventScope(outer, async () => {
    const inner = createEventScope();
    await runInEventScope(inner, () => emitMonitorEvent("BALLOT_SUBMITTED", { eventId: "ev-1" }));
    assert.equal(received.length, 0);
  });
  flushEventScope(outer);
  assert.equal(received.length, 1);
  assert.equal(received[0].type, "BALLOT_SUBMITTED");
});

test("la sanitización se aplica al encolar (antes del flush)", async () => {
  const received = collectEvents();
  const store = createEventScope();
  await runInEventScope(store, async () => {
    emitMonitorEvent("BALLOT_SUBMITTED", {
      eventId: "ev-1",
      score: 10,
      judgeName: "Jurado Secreto",
    });
  });
  flushEventScope(store);
  assert.equal(received.length, 1);
  assert.equal(received[0].score, undefined);
  assert.equal(received[0].judgeName, undefined);
  assert.equal(received[0].eventId, "ev-1");
  assert.ok(received[0].timestamp);
});

test("sanitizeMonitorEvent elimina campos prohibidos de forma recursiva", () => {
  const clean = sanitizeMonitorEvent({
    type: "TEST",
    score: 10,
    nested: { voterId: "x", ok: true },
    list: [{ judgeName: "N", safe: 1 }],
  });
  assert.equal(clean.score, undefined);
  assert.equal(clean.nested.voterId, undefined);
  assert.equal(clean.nested.ok, true);
  assert.equal(clean.list[0].judgeName, undefined);
  assert.equal(clean.list[0].safe, 1);
});

test("resetMonitorEventBus limpia suscriptores entre pruebas", () => {
  const received = collectEvents();
  resetMonitorEventBus();
  emitMonitorEvent("TEST", {});
  assert.equal(received.length, 0, "tras el reset ningún suscriptor debe recibir el evento");
});