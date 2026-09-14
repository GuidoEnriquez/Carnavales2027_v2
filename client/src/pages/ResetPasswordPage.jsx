import { useState } from "react";
import { apiRequest } from "../api/http.js";
import { PageShell } from "../components/PageShell.jsx";

export function ResetPasswordPage({ token }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) return <PageShell><p>El enlace no es válido.</p></PageShell>;

  const submit = async (event) => {
    event.preventDefault();
    if (password.length < 8) {
      setMessage("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await apiRequest("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ newPassword: password, token }),
      });
      setDone(true);
    } catch (error) {
      setMessage(error?.code === "INVALID_TOKEN"
        ? "El enlace venció o ya se usó. Pedí uno nuevo."
        : "No se pudo cambiar la contraseña. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <PageShell>
        <h1>Contraseña actualizada</h1>
        <p>Ya podés ingresar con tu nueva contraseña.</p>
        <a href="#/login">Ir al ingreso</a>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <h1>Definir nueva contraseña</h1>
      <form onSubmit={submit}>
        <label>Nueva contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </label>
        <label>Repetir contraseña
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </label>
        <button type="submit" disabled={loading}>Guardar contraseña</button>
      </form>
      {message && <p role="status">{message}</p>}
    </PageShell>
  );
}
