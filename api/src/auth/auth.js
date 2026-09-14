import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { twoFactor } from "better-auth/plugins";
import nodemailer from "nodemailer";
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
      sendResetPassword: async ({ user, token }) => {
        if (process.env.EMAIL_PROVIDER !== "smtp") {
          console.info(`Reset de contraseña para ${user.email}: token ${token}`);
          return;
        }
        const transport = nodemailer.createTransport({
          host: requireEnvironment("SMTP_HOST"),
          port: Number(process.env.SMTP_PORT ?? 587),
          secure: process.env.SMTP_SECURE === "true",
          auth: {
            user: requireEnvironment("SMTP_USER"),
            pass: requireEnvironment("SMTP_PASSWORD"),
          },
        });
        const url = `${process.env.FRONTEND_URL}/#/reset-password?token=${token}`;
        await transport.sendMail({
          from: requireEnvironment("EMAIL_FROM"),
          to: user.email,
          subject: "Restablecé tu contraseña - Carnavales 2027",
          text: `Entrá a este enlace para definir una nueva contraseña: ${url}`,
          html: `<p>Entrá a este enlace para definir una nueva contraseña:</p><p><a href="${url}">Restablecer contraseña</a></p>`,
        });
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (_user, context) => {
            if (context?.path === "/sign-up/email") {
              throw new APIError("FORBIDDEN", {
                message: "El registro requiere una invitación administrativa.",
              });
            }
          },
        },
      },
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
