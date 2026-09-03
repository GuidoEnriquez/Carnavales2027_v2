import nodemailer from "nodemailer";

function requireEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} no está definida.`);
  return value;
}

function invitationUrl(secret, route = "#/invitations/accept") {
  const frontendUrl = requireEnvironment("FRONTEND_URL").replace(/\/$/, "");
  if (process.env.NODE_ENV === "production" && !frontendUrl.startsWith("https://")) {
    throw new Error("FRONTEND_URL debe usar HTTPS en producción.");
  }
  return `${frontendUrl}/${route}?secret=${encodeURIComponent(secret)}`;
}

export function createInvitationDelivery({
  createTransport = nodemailer.createTransport,
  logger = console,
  route,
} = {}) {
  return async ({ email, name, secret, expiresAt }) => {
    const url = invitationUrl(secret, route);
    const provider = process.env.EMAIL_PROVIDER ?? "console";

    if (provider === "console" && process.env.NODE_ENV !== "production") {
      logger.info(`Invitación de jurado para ${email}: ${url}`);
      return;
    }
    if (provider !== "smtp") {
      throw new Error("EMAIL_PROVIDER=smtp es obligatorio en producción para entregar invitaciones.");
    }

    const transport = createTransport({
      host: requireEnvironment("SMTP_HOST"),
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      requireTLS: process.env.SMTP_SECURE !== "true",
      auth: {
        user: requireEnvironment("SMTP_USER"),
        pass: requireEnvironment("SMTP_PASSWORD"),
      },
    });
    await transport.sendMail({
      from: requireEnvironment("EMAIL_FROM"),
      to: email,
      subject: "Invitación al padrón de jurados",
      text: `Hola ${name}. Completá tu registro antes de ${expiresAt.toISOString()}: ${url}`,
    });
  };
}
