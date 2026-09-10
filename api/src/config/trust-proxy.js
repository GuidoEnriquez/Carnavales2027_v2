import { isIP } from "node:net";

const trustedAliases = new Set(["loopback", "linklocal", "uniquelocal"]);

function invalidTrustProxy() {
  return new Error(
    "INVALID_TRUST_PROXY: use false, 0, un entero de saltos o una lista de IP/CIDR/alias confiables; no se permite true ni confianza global /0.",
  );
}

function isTrustedNetwork(value) {
  if (trustedAliases.has(value)) return true;
  const [address, prefix, extra] = value.split("/");
  const family = isIP(address);
  if (!family || extra !== undefined) return false;
  if (prefix === undefined) return true;
  if (!/^\d+$/.test(prefix)) return false;
  const prefixLength = Number(prefix);
  return prefixLength > 0 && prefixLength <= (family === 4 ? 32 : 128);
}

export function readTrustProxy(environment = process.env) {
  const configured = environment.TRUST_PROXY;
  if (configured === undefined) return 1;
  if (typeof configured !== "string") throw invalidTrustProxy();

  const value = configured.trim();
  if (value === "false") return false;
  if (/^\d+$/.test(value)) {
    const hops = Number(value);
    if (!Number.isSafeInteger(hops)) throw invalidTrustProxy();
    return hops === 0 ? false : hops;
  }

  const networks = value.split(",").map((entry) => entry.trim());
  if (!networks.every(isTrustedNetwork)) throw invalidTrustProxy();
  return networks;
}
