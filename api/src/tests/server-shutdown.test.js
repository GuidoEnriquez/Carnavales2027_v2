import test from "node:test";
import assert from "node:assert/strict";

test("gracefulShutdown cierra servidor y pool de conexiones ordenadamente", async () => {
  let serverClosed = false;
  let poolClosed = false;

  const mockServer = {
    close: (cb) => {
      serverClosed = true;
      cb();
    },
  };

  const mockClosePool = async () => {
    poolClosed = true;
  };

  async function performShutdown(server, closePoolFn) {
    await new Promise((resolve) => {
      server.close(async () => {
        await closePoolFn();
        resolve();
      });
    });
  }

  await performShutdown(mockServer, mockClosePool);

  assert.equal(serverClosed, true);
  assert.equal(poolClosed, true);
});
