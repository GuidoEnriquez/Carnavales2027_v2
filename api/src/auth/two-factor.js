import nodemailer from "nodemailer";

function requireEnvironment(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} no está definida.`);
  }

  return value;
}

export function requireTwoFactor(request, response, next) {
  if (request.user?.twoFactorEnabled !== true) {
    return response.status(403).json({ code: "TWO_FACTOR_REQUIRED" });
  }

  return next();
}

export function createOtpDelivery({
  createTransport = nodemailer.createTransport,
  logger = console,
} = {}) {
  return async ({ user, otp }) => {
    const provider = process.env.EMAIL_PROVIDER ?? "console";

    if (provider === "console" && process.env.NODE_ENV !== "production") {
      logger.info(`2FA OTP for ${user.email}: ${otp}`);
      return;
    }

    if (provider !== "smtp") {
      throw new Error("EMAIL_PROVIDER=smtp es obligatorio en producción para entregar OTP.");
    }

    const transport = createTransport({
      host: requireEnvironment("SMTP_HOST"),
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: requireEnvironment("SMTP_USER"),
        pass: requireEnvironment("SMTP_PASSWORD"),
      },
    });

    await transport.sendMail({
      from: requireEnvironment("EMAIL_FROM"),
      to: user.email,
      subject: "Código de verificación - Carnavales 2027",
      text: `Tu código de verificación es: ${otp}`,
    });
  };
}
