import { useEffect, useState } from "react";
import { apiRequest } from "../api/http.js";

export function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("VEEDOR");
  const [invitationLink, setInvitationLink] = useState("");

  const loadUsers = async () => {
    try {
      const data = await apiRequest("/api/v1/users");
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    setError("");
    setInvitationLink("");
    try {
      const result = await apiRequest("/api/v1/users/invitations", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail, roleCode: inviteRole }),
      });
      const link = `${window.location.origin}${window.location.pathname}#/invitations/role/accept?token=${result.token}`;
      setInvitationLink(link);
      setInviteEmail("");
    } catch (err) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  };

  return (
    <main className="container">
      <header className="page-header">
        <h1>Accesos Operativos</h1>
        <p>Administra Veedores, Comisarios y Escrutadores.</p>
      </header>

      {error && <div className="card alert-error">{error}</div>}

      <section className="card">
        <h2>Generar Invitación</h2>
        <form onSubmit={handleInvite} className="form-group" style={{ display: "flex", gap: "1rem", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="inviteEmail">Correo electrónico</label>
            <input type="email" id="inviteEmail" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} disabled={inviting} />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="inviteRole">Rol Operativo</label>
            <select id="inviteRole" required value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} disabled={inviting}>
              <option value="VEEDOR">Veedor</option>
              <option value="COMISARIO">Comisario</option>
              <option value="SCRUTINEER">Escrutador</option>
            </select>
          </div>
          <button type="submit" disabled={inviting || !inviteEmail}>Generar Link</button>
        </form>

        {invitationLink && (
          <div style={{ marginTop: "1rem", padding: "1rem", background: "var(--bg-color)" }}>
            <p style={{ margin: 0 }}><strong>Link generado:</strong></p>
            <code style={{ wordBreak: "break-all" }}>{invitationLink}</code>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Usuarios Activos</h2>
        {loading ? <p>Cargando...</p> : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Roles Operativos</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.roles.filter(r => r !== 'JUDGE').join(", ")}</td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan="3">No hay usuarios operativos registrados.</td></tr>}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
