import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { twoFactor } from "better-auth/plugins";
import { getPool } from "../db/pool.js";
import { createOtpDelivery } from "./two-factor.js";

function requireEnvironment(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} no está definida.`);
  }

  return value;
}

function getTrustedOrigins() {
  return process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [];
}

export function createAuth({ sendOtp = createOtpDelivery() } = {}) {
  return betterAuth({
    database: getPool(),
    baseURL: requireEnvironment("BETTER_AUTH_URL"),
    secret: requireEnvironment("BETTER_AUTH_SECRET"),
    trustedOrigins: getTrustedOrigins(),
    emailAndPassword: {
      enabled: true,
      revokeSessionsOnPasswordReset: true,
    },
    hooks: {
      after: createAuthMiddleware(async (context) => {
        if (context.path !== "/two-factor/verify-otp") return;

        const verifiedSession = context.context.newSession;
        if (!verifiedSession?.user?.twoFactorEnabled) return;

        const sessions = await context.context.internalAdapter.listSessions(
          verifiedSession.user.id,
        );
        const staleTokens = sessions
          .map((session) => session.token)
          .filter((token) => token !== verifiedSession.session.token);

        if (staleTokens.length > 0) {
          await context.context.internalAdapter.deleteSessions(staleTokens);
        }
      }),
    },
    plugins: [
      twoFactor({
        skipVerificationOnEnable: false,
        otpOptions: {
          digits: 6,
          period: 5,
          storeOTP: "encrypted",
          sendOTP: sendOtp,
        },
      }),
    ],
  });
}

export const auth = createAuth();
