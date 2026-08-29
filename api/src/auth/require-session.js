export function createRequireSession(getSession) {
  if (typeof getSession !== "function") {
    throw new TypeError("getSession debe ser una función.");
  }

  return async function requireSession(request, response, next) {
    try {
      const session = await getSession({
        headers: new Headers(request.headers),
      });

      if (!session?.user) {
        return response.status(401).json({ code: "UNAUTHENTICATED" });
      }

      request.session = session.session;
      request.user = session.user;
      return next();
    } catch {
      return response.status(401).json({ code: "UNAUTHENTICATED" });
    }
  };
}
