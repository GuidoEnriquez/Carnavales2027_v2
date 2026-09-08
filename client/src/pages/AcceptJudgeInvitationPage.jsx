import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell.jsx";
import { apiRequest } from "../api/http.js";

export function AcceptJudgeInvitationPage({ secret }) {
  const [invitation, setInvitation] = useState(null);
  const [status, setStatus] = useState(secret ? "loading" : "invalid");
  const [message, setMessage] = useState(secret ? "" : "La invitación no es válida.");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [acceptanceAmbiguous, setAcceptanceAmbiguous] = useState(false);

  useEffect(() => {
    setInvitation(null);
    setMessage("");
    setAcceptanceAmbiguous(false);
    if (!secret) {
      setStatus("invalid");
      setMessage("La invitación no es válida.");
      return;
    }
    window.history.replaceState(null, "", "#/invitations/accept");
    setStatus("loading");
    let current = true;
    void apiRequest("/api/v1/judge-invitations/inspect", {
      method: "POST",
      body: JSON.stringify({ secret }),
    }).then((data) => {
      if (!current) return;
      setInvitation(data);
      setStatus("ready");
    }).catch((error) => {
      if (!current) return;
      if (error.code === "INVITATION_INVALID") {
        setStatus("invalid");
        setMessage("La invitación es inválida, fue usada o venció.");
      } else {
        setStatus("error");
        setMessage("No se pudo verificar la invitación. Revisá la conexión e intentá nuevamente.");
      }
    });
    return () => { current = false; };
  }, [secret, attempt]);

  const accept = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (data.get("password") !== data.get("passwordConfirmation")) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await apiRequest("/api/v1/judge-invitations/accept", {
        method: "POST",
        body: JSON.stringify({ secret, password: data.get("password") }),
      });
      window.history.replaceState(null, "", "#/invitations/accepted");
      setAcceptanceAmbiguous(false);
      setStatus("accepted");
    } catch (error) {
      if (error.code === "INVITATION_INVALID") {
        setStatus("invalid");
        setMessage("La invitación es inválida, fue usada o venció.");
      } else {
        setAcceptanceAmbiguous(true);
        setMessage("No se recibió confirmación. Podés reintentar o probar iniciar sesión si la cuenta llegó a crearse.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell layer="brand" className="container invitation-page">
      <div className="card">
        <p className="eyebrow">Padrón de jurados</p>
        <h1>Completar registro</h1>
        {status === "loading" && <p>Verificando invitación…</p>}
        {status === "invalid" && <p role="alert">{message}</p>}
        {status === "error" && <div role="alert"><p>{message}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>Reintentar</button></div>}
        {acceptanceAmbiguous && <p><a href="#/login">Probar inicio de sesión</a></p>}
        {status === "accepted" && <div className="success-panel"><h2>Cuenta creada</h2><p>Iniciá sesión y completá la verificación en dos pasos. Todavía no tenés una asignación para votar.</p><a className="button-link" href="#/login">Continuar al inicio de sesión</a></div>}
        {status === "ready" && <>
          <p>Invitación para <strong>{invitation.maskedEmail}</strong>. Vence el {new Date(invitation.expiresAt).toLocaleString()}.</p>
          <form onSubmit={accept}>
            <label>Nueva contraseña<input name="password" type="password" minLength="8" maxLength="128" autoComplete="new-password" required /></label>
            <label>Repetir contraseña<input name="passwordConfirmation" type="password" minLength="8" maxLength="128" autoComplete="new-password" required /></label>
            <button disabled={busy}>Crear cuenta</button>
          </form>
          <p role="status" aria-live="polite">{message}</p>
        </>}
      </div>
    </PageShell>
  );
}

export function AcceptedJudgeInvitationPage() {
  return <PageShell layer="brand" className="container invitation-page"><div className="card"><p className="eyebrow">Padrón de jurados</p><h1>Cuenta creada</h1><p>Iniciá sesión y completá la verificación en dos pasos. Todavía no tenés una asignación para votar.</p><a className="button-link" href="#/login">Continuar al inicio de sesión</a></div></PageShell>;
}
