import { useEffect, useState } from "react";
import { apiRequest } from "../api/http.js";

export function AcceptRoleInvitationPage({ token }) {
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest(`/api/v1/invitations/role/${token}`)
      .then(setInvitation)
      .catch((err) => setError(err.code === "INVITATION_NOT_FOUND" ? "El link de invitación no es válido o ha expirado." : err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiRequest("/api/v1/invitations/role/accept", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      window.location.hash = "#/login";
    } catch (err) {
      setError(err.code === "INVITATION_INVALID" ? "El link expiró o ya fue usado." : err.message);
      setSaving(false);
    }
  };

  if (loading) return <main className="container"><div className="card"><p>Verificando invitación...</p></div></main>;

  if (error && !invitation) {
    return (
      <main className="container">
        <div className="card">
          <h1>Invitación inválida</h1>
          <p>{error}</p>
          <a href="#/login">Ir al inicio de sesión</a>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="card">
        <h1>Aceptar acceso como {invitation.roleCode}</h1>
        <p>Estás a punto de crear o asociar tu cuenta <strong>{invitation.email}</strong>.</p>

        {error && <p className="alert-error" style={{ color: "red" }}>{error}</p>}

        <form onSubmit={handleSubmit} className="form-group">
          <label htmlFor="password">Crea una contraseña (mínimo 8 caracteres)</label>
          <input
            type="password"
            id="password"
            required
            minLength="8"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={saving}
          />
          <button type="submit" disabled={saving || password.length < 8}>
            {saving ? "Registrando..." : "Crear cuenta y acceder"}
          </button>
        </form>
      </div>
    </main>
  );
}
