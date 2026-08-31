import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;

if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
