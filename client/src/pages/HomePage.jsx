export function HomePage({ session }) {
  const roles = session?.roles ?? [];
  const areas = [
    ...(roles.includes("ADMIN")
      ? [
          ["Administración", "Configurá el evento, etapas y prepará la operación.", "#/admin/events", "Administrar eventos"],
          ["Personas", "Gestioná jurados y accesos auxiliares.", "#/admin/judges", "Administrar personas"],
          ["Asignaciones", "Distribuí jurados por noche y especialidad.", "#/admin/assignments", "Ver asignaciones"],
          ["Votación", "Abrí y controlá las planillas habilitadas.", "#/admin/voting", "Controlar votación"],
        ]
      : []),
    ...(roles.includes("JUDGE")
      ? [["Jurado", "Completá tus evaluaciones asignadas para cada noche.", "#/judge", "Mi panel de jurado"]]
      : []),
    ...(roles.includes("COMISARIO")
      ? [["Comisariato", "Registrá y revisá penalizaciones reglamentarias.", "#/admin/penalties", "Gestionar penalizaciones"]]
      : []),
    ...(roles.some((role) => ["SCRUTINEER", "ESCRIBANO"].includes(role))
      ? [
          ["Escrutinio", "Revisá y certificá el resultado oficial de la votación.", "#/admin/results", "Abrir escrutinio"],
          ["Acta oficial", "Consultá y emití el acta notarial certificada.", "#/admin/record", "Ver acta oficial"],
        ]
      : []),
    ...(roles.includes("VEEDOR")
      ? [["Supervisión", "Controlá el avance en tiempo real sin acceder a puntajes.", "#/veedor", "Abrir supervisión"]]
      : []),
  ];

  return (
    <main className="container home-page" data-layer="brand">
      <div className="card home-hero-card">
        <p className="eyebrow">Sesión verificada</p>
        <h1>Carnavales Goya <span>2027</span></h1>
        <p className="home-subtitle">Elegí tu área de trabajo para comenzar.</p>
        <div className="role-area-grid">
          {areas.map(([title, description, href, action]) => (
            <article className="role-area-card" key={href}>
              <div className="role-area-header">
                <span className="role-area-pill">{title}</span>
              </div>
              <p className="role-area-desc">{description}</p>
              <a className="button-link primary-action" href={href}>
                {action}
              </a>
            </article>
          ))}
          {areas.length === 0 && (
            <div className="empty-roles-notice" role="status">
              <p>Tu cuenta no tiene un rol operativo activo asignado actualmente.</p>
              <p className="text-muted">Comunicate con la comisión organizadora o el administrador del sistema.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
