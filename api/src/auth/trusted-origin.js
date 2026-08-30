const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export function requireTrustedOrigin(request, response, next) {
  if (safeMethods.has(request.method)) return next();
  const expectedOrigin = process.env.FRONTEND_URL;
  const origin = request.get("origin");

  if (origin && expectedOrigin && origin !== expectedOrigin) {
    return response.status(403).json({ code: "UNTRUSTED_ORIGIN" });
  }
  if (process.env.NODE_ENV === "production" && (!origin || !expectedOrigin)) {
    return response.status(403).json({ code: "UNTRUSTED_ORIGIN" });
  }
  return next();
}
