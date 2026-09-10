import { rateLimit } from "express-rate-limit";

function shouldSkipRateLimit() {
  return process.env.NODE_ENV === "test" && process.env.ENABLE_RATE_LIMIT_TESTS !== "true";
}

export function isSessionRead(request) {
  return (request.method === "GET" || request.method === "HEAD")
    && request.path === "/api/auth/get-session";
}

export function createAuthGeneralRateLimiter(options = {}) {
  // Each factory call creates its own MemoryStore; never share the API counter.
  return createGeneralApiRateLimiter(options);
}

export function createAuthRateLimiter(options = {}) {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { code: "RATE_LIMIT_EXCEEDED", message: "Demasiados intentos de autenticación. Intente más tarde." },
    skip: shouldSkipRateLimit,
    handler: (req, res, _next, opts) => {
      res.status(opts.statusCode).json(opts.message);
    },
    ...options,
  });
}

export function createInvitationRateLimiter(options = {}) {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { code: "RATE_LIMIT_EXCEEDED", message: "Demasiados intentos de invitación. Intente más tarde." },
    skip: shouldSkipRateLimit,
    handler: (req, res, _next, opts) => {
      res.status(opts.statusCode).json(opts.message);
    },
    ...options,
  });
}

export function createGeneralApiRateLimiter(options = {}) {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { code: "RATE_LIMIT_EXCEEDED", message: "Límite de solicitudes de API excedido. Intente más tarde." },
    skip: shouldSkipRateLimit,
    handler: (req, res, _next, opts) => {
      res.status(opts.statusCode).json(opts.message);
    },
    ...options,
  });
}
