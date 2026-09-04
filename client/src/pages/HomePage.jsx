export function HomePage({ session }) {
  const roles = session.roles ?? [];
  const areas = [
    ...(roles.includes("ADMIN") ? [
      ["Administración", "Configurá el evento y prepará la operación.", "#/admin/events", "Administrar eventos"],
      ["Personas", "Gestioná jurados y accesos auxiliares.", "#/admin/judges", "Administrar personas"],
      ["Asignaciones", "Distribuí jurados por noche y especialidad.", "#/admin/assignments", "Ver asignaciones"],
      ["Votación", "Abrí y controlá las planillas habilitadas.", "#/admin/voting", "Controlar votación"],
    ] : []),
    ...(roles.includes("JUDGE") ? [["Jurado", "Completá tus evaluaciones asignadas.", "#/judge", "Mi panel de jurado"]] : []),
    ...(roles.includes("COMISARIO") ? [["Comisariato", "Registrá y revisá penalizaciones reglamentarias.", "#/admin/penalties", "Gestionar penalizaciones"]] : []),
    ...(roles.some((role) => ["SCRUTINEER", "ESCRIBANO"].includes(role)) ? [
      ["Escrutinio", "Revisá y certificá el resultado de la votación.", "#/admin/results", "Abrir escrutinio"],
      ["Acta oficial", "Consultá el acta certificada del evento.", "#/admin/record", "Ver acta oficial"],
    ] : []),
    ...(roles.includes("VEEDOR") ? [["Supervisión", "Controlá el avance sin acceder a puntajes ni identidades.", "#/veedor", "Abrir supervisión"]] : []),
  ];
  return (
    <main className="container">
      <div className="card">
        <p className="eyebrow">Sesión verificada</p>
        <h1>Elegí un área</h1>
        <div className="role-area-grid">
          {areas.map(([title, description, href, action]) => <article className="role-area-card" key={href}><p className="eyebrow">{title}</p><p>{description}</p><a className="button-link" href={href}>{action}</a></article>)}
          {areas.length === 0 && <p>Tu cuenta no tiene un rol operativo asignado.</p>}
        </div>
      </div>
    </main>
  );
}
