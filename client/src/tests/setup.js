import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;

if (typeof window !== "undefined" && !window.localStorage) {
  const store = new Map();
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
      setItem: (key, value) => void store.set(String(key), String(value)),
      removeItem: (key) => void store.delete(String(key)),
      clear: () => void store.clear(),
      key: (index) => [...store.keys()][index] ?? null,
      get length() { return store.size; },
    },
    configurable: true,
  });
}

if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
