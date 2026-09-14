import { useState } from "react";
import { apiRequest } from "../api/http.js";
import { PageShell } from "../components/PageShell.jsx";

export function AccountPage() {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (password.length < 8) {
      setMessage("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await apiRequest("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: password }),
      });
      setMessage("Contraseña actualizada.");
      setCurrent("");
      setPassword("");
      setConfirm("");
    } catch (error) {
      setMessage(error?.code === "INVALID_PASSWORD"
        ? "La contraseña actual no es correcta."
        : "No se pudo cambiar la contraseña. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <h1>Mi cuenta</h1>
      <h2>Cambiar contraseña</h2>
      <form onSubmit={submit}>
        <label>Contraseña actual
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </label>
        <label>Nueva contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </label>
        <label>Repetir nueva contraseña
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </label>
        <button type="submit" disabled={loading}>Guardar nueva contraseña</button>
      </form>
      {message && <p role="status">{message}</p>}
    </PageShell>
  );
}
