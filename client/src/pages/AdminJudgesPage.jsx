import { useEffect, useState } from "react";
import { apiRequest } from "../api/http.js";

const statusLabels = {
  INVITED: "Invitado",
  REGISTERED: "Registrado",
  SUSPENDED: "Suspendido",
  PENDING: "Pendiente",
  EXPIRED: "Vencida",
  REVOKED: "Revocada",
  USED: "Usada",
};

export function AdminJudgesPage() {
  const [judges, setJudges] = useState([]);
  const [operationalProfiles, setOperationalProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [creationType, setCreationType] = useState("JUDGE");

  const refresh = async () => {
    setLoading(true);
    try {
      const [nextJudges, nextOperational] = await Promise.all([
        apiRequest("/api/v1/judges"),
        apiRequest("/api/v1/operational-profiles"),
      ]);
      setJudges(nextJudges);
      setOperationalProfiles(nextOperational);
      setLoadError(false);
    } catch {
      setJudges([]);
      setOperationalProfiles([]);
      setLoadError(true);
      setMessage("No se pudieron cargar las personas y accesos.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void refresh(); }, []);

  const create = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy("create");
    setMessage("");
    try {
      if (creationType === "JUDGE") {
        await apiRequest("/api/v1/judges", {
          method: "POST",
          body: JSON.stringify({
            name: data.get("name"),
            email: data.get("email"),
            documentNumber: data.get("documentNumber"),
          }),
        });
        setMessage("Jurado registrado e invitación enviada.");
      } else {
        await apiRequest("/api/v1/operational-profiles", {
          method: "POST",
          body: JSON.stringify({
            name: data.get("name"),
            email: data.get("email"),
            documentNumber: data.get("documentNumber"),
            roleCodes: [creationType],
          }),
        });
        setMessage("Perfil registrado e invitación enviada.");
      }
      form.reset();
    } catch (error) {
      setMessage(
        error.code === "TWO_FACTOR_REQUIRED"
          ? "Necesitás habilitar la verificación en dos pasos para realizar esta acción."
          : error.code === "INVITATION_DELIVERY_FAILED"
            ? "El perfil fue creado, pero el correo no pudo entregarse. Podés reemitir la invitación."
            : error.code === "ACCOUNT_ALREADY_EXISTS"
              ? "Ya existe una cuenta con ese correo."
              : error.code === "PROFILE_ALREADY_EXISTS" || error.code === "RESOURCE_CONFLICT"
                ? "Ya existe un perfil operativo con ese correo."
                : "No se pudo generar la invitación."
      );
    } finally {
      await refresh();
      setBusy("");
    }
  };

  const action = async (key, path, method, success) => {
    if (busy) return;
    setBusy(key);
    setMessage("");
    try {
      await apiRequest(path, { method });
      setMessage(success);
    } catch (error) {
      setMessage(
        error.code === "SESSION_REVOCATION_FAILED"
          ? "El perfil quedó suspendido, pero no se pudieron cerrar sus sesiones. Reintentá Suspender."
          : "No se pudo completar la acción."
      );
    } finally {
      await refresh();
      setBusy("");
    }
  };

  return (
    <main className="admin-shell roster-page">
      <header className="event-header">
        <div><p className="eyebrow">Identidad y acceso</p><h1>Personas y accesos</h1></div>
        <span className="roster-count">{judges.length} jurados · {operationalProfiles.length} auxiliares</span>
      </header>

      <section className="config-section">
        <div className="section-heading"><div><h2>Incorporar persona</h2><p>{creationType === "JUDGE" ? "Registrar no habilita votación. La especialidad se definirá en cada asignación." : "Se creará un perfil con nombre, DNI y el rol seleccionado."}</p></div></div>
        <form className="judge-create-form" onSubmit={create}>
          <label>Tipo de alta
            <select value={creationType} onChange={(event) => setCreationType(event.target.value)} disabled={Boolean(busy)}>
              <option value="JUDGE">Jurado</option>
              <option value="VEEDOR">Veedor</option>
              <option value="COMISARIO">Comisario</option>
              <option value="SCRUTINEER">Escrutador</option>
              <option value="ESCRIBANO">Escribano</option>
            </select>
          </label>
          <label>Nombre completo<input name="name" autoComplete="name" required /></label>
          <label>Correo<input name="email" type="email" autoComplete="email" required /></label>
          <label>DNI<input name="documentNumber" inputMode="numeric" required /></label>
          <button disabled={Boolean(busy)}>{creationType === "JUDGE" ? "Registrar e invitar" : "Registrar e invitar"}</button>
        </form>
      </section>

      <p className="feedback" role="status" aria-live="polite">{message}</p>
      {loading ? <p>Cargando padrón…</p> : loadError ? null : judges.length === 0 ? <p className="empty-state">Todavía no hay jurados registrados.</p> : (
        <section className="judge-grid" aria-label="Padrón de jurados">
          {judges.map((judge) => {
            const invitation = judge.invitation;
            const rowBusy = Boolean(busy);
            return (
              <article className="judge-card" key={judge.id}>
                <div className="judge-card-heading">
                  <div><p className="eyebrow">DNI {judge.documentNumber}</p><h2>{judge.name}</h2><p>{judge.email}</p></div>
                  <span className={`judge-status status-${judge.registrationStatus.toLowerCase()}`}>{statusLabels[judge.registrationStatus]}</span>
                </div>
                {invitation && <p className="invitation-state">Invitación: <strong>{statusLabels[invitation.status] ?? invitation.status}</strong></p>}
                <div className="judge-actions">
                  {judge.registrationStatus === "INVITED" && <button type="button" aria-label={`Reemitir invitación para ${judge.name}`} disabled={rowBusy} onClick={() => {
                    if (window.confirm("¿Reemitir la invitación? El enlace anterior dejará de funcionar.")) void action(`${judge.id}-invite`, `/api/v1/judges/${judge.id}/invitations`, "POST", "Invitación reemitida.");
                  }}>Reemitir invitación</button>}
                  {judge.registrationStatus === "INVITED" && invitation?.status === "PENDING" && <button className="secondary" type="button" disabled={rowBusy} onClick={() => {
                    if (window.confirm("¿Revocar esta invitación?")) void action(`${judge.id}-revoke`, `/api/v1/judges/${judge.id}/invitations/${invitation.id}`, "DELETE", "Invitación revocada.");
                  }} aria-label={`Revocar invitación de ${judge.name}`}>Revocar</button>}
                  {judge.registrationStatus === "REGISTERED" && <button className="danger-action" type="button" disabled={rowBusy} onClick={() => {
                    if (window.confirm("¿Suspender al jurado y cerrar todas sus sesiones?")) void action(`${judge.id}-suspend`, `/api/v1/judges/${judge.id}/suspend`, "POST", "Jurado suspendido y sesiones revocadas.");
                  }} aria-label={`Suspender a ${judge.name}`}>Suspender</button>}
                  {judge.registrationStatus === "SUSPENDED" && <button className="secondary" type="button" aria-label={`Reintentar cierre de sesiones de ${judge.name}`} disabled={rowBusy} onClick={() => action(`${judge.id}-suspend`, `/api/v1/judges/${judge.id}/suspend`, "POST", "Sesiones revocadas.")}>Reintentar cierre de sesiones</button>}
                  {judge.registrationStatus === "SUSPENDED" && <button type="button" aria-label={`Reactivar a ${judge.name}`} disabled={rowBusy} onClick={() => action(`${judge.id}-reactivate`, `/api/v1/judges/${judge.id}/reactivate`, "POST", "Jurado reactivado.")}>Reactivar</button>}
                </div>
              </article>
            );
          })}
        </section>
      )}
      {!loading && !loadError && <section className="config-section operational-roster">
        <div className="section-heading"><div><h2>Accesos auxiliares</h2><p>Veedores, Comisarios, Escrutadores y Escribanos.</p></div></div>
        {operationalProfiles.length === 0 ? <p className="empty-state">Todavía no hay accesos auxiliares.</p> : <div className="operational-user-list">
          {operationalProfiles.map((profile) => {
            const invitation = profile.invitation;
            const rowBusy = Boolean(busy);
            return (
              <article className="judge-card operational-profile-card" key={profile.id}>
                <div className="judge-card-heading">
                  <div><p className="eyebrow">DNI {profile.documentNumber}</p><h2>{profile.name}</h2><p>{profile.email}</p></div>
                  <span className={`judge-status status-${profile.registrationStatus.toLowerCase()}`}>{statusLabels[profile.registrationStatus]}</span>
                </div>
                <p className="operational-roles">{profile.roles.join(", ")}</p>
                {invitation && <p className="invitation-state">Invitación: <strong>{statusLabels[invitation.status] ?? invitation.status}</strong></p>}
                <div className="judge-actions">
                  {profile.registrationStatus === "INVITED" && <button type="button" aria-label={`Reemitir invitación para ${profile.name}`} disabled={rowBusy} onClick={() => {
                    if (window.confirm("¿Reemitir la invitación? El enlace anterior dejará de funcionar.")) void action(`${profile.id}-invite`, `/api/v1/operational-profiles/${profile.id}/invitations`, "POST", "Invitación reemitida.");
                  }}>Reemitir invitación</button>}
                  {profile.registrationStatus === "INVITED" && invitation?.status === "PENDING" && <button className="secondary" type="button" disabled={rowBusy} onClick={() => {
                    if (window.confirm("¿Revocar esta invitación?")) void action(`${profile.id}-revoke`, `/api/v1/operational-profiles/${profile.id}/invitations/${invitation.id}`, "DELETE", "Invitación revocada.");
                  }} aria-label={`Revocar invitación de ${profile.name}`}>Revocar</button>}
                  {profile.registrationStatus === "REGISTERED" && <button className="danger-action" type="button" disabled={rowBusy} onClick={() => {
                    if (window.confirm("¿Suspender y cerrar todas sus sesiones?")) void action(`${profile.id}-suspend`, `/api/v1/operational-profiles/${profile.id}/suspend`, "POST", "Suspendido y sesiones revocadas.");
                  }} aria-label={`Suspender a ${profile.name}`}>Suspender</button>}
                  {profile.registrationStatus === "SUSPENDED" && <button type="button" aria-label={`Reactivar a ${profile.name}`} disabled={rowBusy} onClick={() => action(`${profile.id}-reactivate`, `/api/v1/operational-profiles/${profile.id}/reactivate`, "POST", "Reactivado.")}>Reactivar</button>}
                </div>
              </article>
            );
          })}
        </div>}
      </section>}
    </main>
  );
}
