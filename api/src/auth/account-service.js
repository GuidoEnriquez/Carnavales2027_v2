function requireText(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} debe ser texto no vacío.`);
  }
  return value.trim();
}

function requirePassword(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError("password debe ser texto no vacío.");
  }
  if (value.length < 8 || value.length > 128) {
    throw new TypeError("password debe tener entre 8 y 128 caracteres.");
  }
  return value;
}

async function getAuthContext(authInstance) {
  if (authInstance) return authInstance.$context;
  const { auth } = await import("./auth.js");
  return auth.$context;
}

export async function createCredentialUser({ email, name, password, authInstance }) {
  const normalizedEmail = requireText(email, "email").toLowerCase();
  const normalizedName = requireText(name, "name");
  const normalizedPassword = requirePassword(password);

  const context = await getAuthContext(authInstance);
  if (await context.internalAdapter.findUserByEmail(normalizedEmail, { includeAccounts: true })) {
    throw new Error("ACCOUNT_ALREADY_EXISTS");
  }

  const passwordHash = await context.password.hash(normalizedPassword);
  const user = await context.internalAdapter.createUser({
    email: normalizedEmail,
    name: normalizedName,
    emailVerified: false,
  });

  try {
    await context.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: passwordHash,
    });
    return user;
  } catch (error) {
    await context.internalAdapter.deleteUser(user.id);
    throw error;
  }
}

export async function createOrVerifyCredentialUser({ email, name, password, authInstance }) {
  const normalizedEmail = requireText(email, "email").toLowerCase();
  const normalizedPassword = requirePassword(password);
  const context = await getAuthContext(authInstance);
  const existing = await context.internalAdapter.findUserByEmail(normalizedEmail, { includeAccounts: true });
  if (!existing) {
    return { user: await createCredentialUser({ email: normalizedEmail, name, password: normalizedPassword, authInstance }), created: true };
  }

  const credential = existing.accounts.find((account) => account.providerId === "credential");
  if (!credential?.password || !await context.password.verify({
    hash: credential.password,
    password: normalizedPassword,
  })) {
    throw new Error("ACCOUNT_ALREADY_EXISTS");
  }
  return { user: existing.user, created: false };
}

export async function revokeUserSessions(userId) {
  const context = await getAuthContext();
  await context.internalAdapter.deleteUserSessions(requireText(userId, "userId"));
}
