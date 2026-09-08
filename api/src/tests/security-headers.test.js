import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.js";

test("Helmet añade cabeceras de seguridad esperadas a las respuestas", async () => {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 200);

    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.match(response.headers.get("content-security-policy"), /default-src 'none'/);
  } finally {
    server.close();
  }
});

test("Rechaza payload JSON que excede 100kb con HTTP 413", async () => {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const oversizedBody = JSON.stringify({ data: "x".repeat(105 * 1024) });
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/judge-invitations/inspect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://127.0.0.1",
      },
      body: oversizedBody,
    });

    assert.equal(response.status, 413);
    const body = await response.json();
    assert.equal(body.code, "PAYLOAD_TOO_LARGE");
  } finally {
    server.close();
  }
});
