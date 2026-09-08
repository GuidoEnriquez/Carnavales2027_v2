import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell.jsx";
import { apiRequest } from "../api/http.js";

export function AcceptOperationalInvitationPage({ secret }) {
  const [invitation, setInvitation] = useState(null);
  const [status, setStatus] = useState(secret ? "loading" : "invalid");
  const [message, setMessage] = useState(secret ? "" : "La invitación no es válida.");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!secret) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#/invitations/operational/accept`);
    let current = true;
    apiRequest("/api/v1/operational-invitations/inspect", {
      method: "POST",
      body: JSON.stringify({ secret }),
    })
      .then((data) => {
        if (!current) return;
        setInvitation(data);
        setStatus("ready");
      })
      .catch(() => {
        if (!current) return;
        setStatus("invalid");
        setMessage("El link de invitación no es válido, ya fue usado o ha expirado.");
      });
    return () => { current = false; };
  }, [secret]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = data.get("password");
    if (password !== data.get("passwordConfirmation")) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await apiRequest("/api/v1/operational-invitations/accept", {
        method: "POST",
        body: JSON.stringify({
          secret,
          password,
        }),
      });
      setStatus("accepted");
    } catch {
      setStatus("invalid");
      setMessage("El link de invitación no es válido, ya fue usado o ha expirado.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell layer="brand" className="container invitation-page">
      <div className="card">
        <p className="eyebrow">Acceso operativo</p>
        <h1>Completar registro</h1>
        {status === "loading" && <p>Verificando invitación…</p>}
        {status === "invalid" && <div role="alert"><p>{message}</p><a href="#/login">Ir al inicio de sesión</a></div>}
        {status === "accepted" && <div className="success-panel"><h2>Cuenta creada</h2><p>Iniciá sesión y completá la verificación en dos pasos antes de acceder.</p><a className="button-link" href="#/login">Continuar al inicio de sesión</a></div>}
        {status === "ready" && <>
          <p>Invitación para <strong>{invitation.maskedEmail}</strong> como {invitation.roles.join(", ")}. Vence el {new Date(invitation.expiresAt).toLocaleString()}.</p>
          <form onSubmit={handleSubmit}>
            <label>Nueva contraseña<input name="password" type="password" minLength="8" maxLength="128" autoComplete="new-password" required /></label>
            <label>Repetir contraseña<input name="passwordConfirmation" type="password" minLength="8" maxLength="128" autoComplete="new-password" required /></label>
            <button disabled={saving}>{saving ? "Creando cuenta…" : "Crear cuenta"}</button>
          </form>
          <p role="status" aria-live="polite">{message}</p>
        </>}
      </div>
    </PageShell>
  );
}
