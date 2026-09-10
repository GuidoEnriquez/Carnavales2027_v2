import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createApp } from "../app.js";
import { readTrustProxy } from "../config/trust-proxy.js";

test("TRUST_PROXY convierte saltos y desactivación sin confundirlos con IP", () => {
  assert.equal(readTrustProxy({}), 1);
  for (const value of ["0", "false", " false ", "00"]) {
    assert.equal(readTrustProxy({ TRUST_PROXY: value }), false);
  }
  assert.equal(readTrustProxy({ TRUST_PROXY: "1" }), 1);
  assert.equal(readTrustProxy({ TRUST_PROXY: " 2 " }), 2);
});

test("TRUST_PROXY admite redes y alias explícitos", () => {
  assert.deepEqual(readTrustProxy({ TRUST_PROXY: "127.0.0.1, ::1, 10.0.0.0/8, 2001:db8::/32" }),
    ["127.0.0.1", "::1", "10.0.0.0/8", "2001:db8::/32"]);
  assert.deepEqual(readTrustProxy({ TRUST_PROXY: "loopback, linklocal, uniquelocal" }),
    ["loopback", "linklocal", "uniquelocal"]);
});

test("TRUST_PROXY rechaza confianza global y entradas inválidas sin reflejar su valor", () => {
  for (const value of ["", " ", "true", "-1", "1.5", "9007199254740992", "proxy.example.test",
    "127.0.0.1,", ",loopback", "10.0.0.0/33", "::1/129", "::1/-1", "::1/32/64",
    "0.0.0.0/0", "::/0", "127.0.0.1/", "localhost", "loopback, true", "false,loopback"]) {
    assert.throws(() => readTrustProxy({ TRUST_PROXY: value }), { message: /^INVALID_TRUST_PROXY:/ });
  }
  assert.throws(() => readTrustProxy({ TRUST_PROXY: "private-invalid-value" }), (error) => {
    assert.ok(!error.message.includes("private-invalid-value"));
    return true;
  });
});

test("createApp valida TRUST_PROXY al iniciar y compila sus formas admitidas", (context) => {
  const previous = process.env.TRUST_PROXY;
  context.after(() => {
    if (previous === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previous;
  });
  for (const value of ["true", "", "-1", "10.0.0.0/33"]) {
    process.env.TRUST_PROXY = value;
    assert.throws(() => createApp(), { message: /^INVALID_TRUST_PROXY:/ });
  }
  for (const value of ["1", "loopback", "127.0.0.1/32", "::1/128", "linklocal,uniquelocal"]) {
    process.env.TRUST_PROXY = value;
    assert.doesNotThrow(() => createApp());
  }
  process.env.TRUST_PROXY = "1";
  const trust = createApp().get("trust proxy fn");
  assert.equal(trust("127.0.0.1", 0), true);
  assert.equal(trust("192.0.2.10", 1), false);
});

test("HTTP ignora X-Forwarded-For con 0/false y respeta el salto o red configurados", async (context) => {
  const previous = process.env.TRUST_PROXY;
  context.after(() => {
    if (previous === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previous;
  });
  for (const [value, expected] of [["0", "127.0.0.1"], ["false", "127.0.0.1"],
    ["1", "192.0.2.10"], ["loopback", "192.0.2.10"], ["10.0.0.0/8", "127.0.0.1"]]) {
    process.env.TRUST_PROXY = value;
    const app = createApp();
    app.get("/proxy-test", (req, res) => res.json({ ip: req.ip }));
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/proxy-test`, {
        headers: { "X-Forwarded-For": "192.0.2.10" },
      });
      assert.deepEqual(await response.json(), { ip: expected }, value);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }
});
