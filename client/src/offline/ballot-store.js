const DB_NAME = "carnavales-offline";
const DB_VERSION = 1;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

function nextOrder() {
  return performance.timeOrigin + performance.now();
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("entries")) database.createObjectStore("entries", { keyPath: "id" });
      if (!database.objectStoreNames.contains("keys")) database.createObjectStore("keys", { keyPath: "userId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(name, mode, operation) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(name, mode);
    const result = await operation(transaction.objectStore(name));
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    return result;
  } finally {
    database.close();
  }
}

async function getKey(userId) {
  const existing = await withStore("keys", "readonly", (store) => requestResult(store.get(userId)));
  if (existing?.key) return existing.key;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await withStore("keys", "readwrite", (store) => requestResult(store.put({ userId, key })));
  return key;
}

async function encrypt(userId, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await getKey(userId), plaintext);
  return { iv, ciphertext };
}

async function decrypt(userId, payload) {
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: payload.iv }, await getKey(userId), payload.ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext));
}

async function putEntry(userId, entry) {
  const payload = await encrypt(userId, entry.payload);
  await withStore("entries", "readwrite", (store) => requestResult(store.put({ ...entry, userId, payload })));
}

async function getEntry(id) {
  return withStore("entries", "readonly", (store) => requestResult(store.get(id)));
}

export async function cacheBallot(userId, ballot) {
  await putEntry(userId, {
    id: `ballot:${userId}:${ballot.id}`,
    kind: "ballot",
    ballotId: ballot.id,
    createdAt: Date.now(),
    payload: ballot,
  });
}

export async function getCachedBallot(userId, ballotId) {
  const entry = await getEntry(`ballot:${userId}:${ballotId}`);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    await withStore("entries", "readwrite", (store) => requestResult(store.delete(entry.id)));
    return null;
  }
  return decrypt(userId, entry.payload);
}

export async function enqueueOperation(userId, operation) {
  await putEntry(userId, {
    id: `operation:${userId}:${operation.operationId}`,
    kind: "operation",
    ballotId: operation.ballotId,
    createdAt: Date.now(),
    order: nextOrder(),
    payload: operation,
  });
}

export async function getBallotOperations(userId, ballotId) {
  const entries = await withStore("entries", "readonly", (store) => requestResult(store.getAll()));
  const operations = await Promise.all(entries
    .filter((entry) => entry.userId === userId && entry.kind === "operation" && entry.ballotId === ballotId)
    .sort((left, right) => left.order - right.order)
    .map(async (entry) => ({ ...(await decrypt(userId, entry.payload)), createdAt: entry.createdAt })));
  return operations;
}

export async function removeOperations(userId, operationIds) {
  await withStore("entries", "readwrite", async (store) => {
    await Promise.all(operationIds.map((operationId) => requestResult(store.delete(`operation:${userId}:${operationId}`))));
  });
}

export async function clearBallotOperations(userId, ballotId) {
  const operations = await getBallotOperations(userId, ballotId);
  await removeOperations(userId, operations.map((operation) => operation.operationId));
}

export async function clearUserOfflineData(userId) {
  const entries = await withStore("entries", "readonly", (store) => requestResult(store.getAll()));
  await withStore("entries", "readwrite", async (store) => {
    await Promise.all(entries.filter((entry) => entry.userId === userId).map((entry) => requestResult(store.delete(entry.id))));
  });
  await withStore("keys", "readwrite", (store) => requestResult(store.delete(userId)));
}

export function isOperationExpired(operation) {
  return Date.now() - operation.createdAt > CACHE_TTL_MS;
}
