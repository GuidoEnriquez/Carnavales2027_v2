export function HomePage({ session }) {
  return (
    <main className="container">
      <div className="card">
        <p className="eyebrow">Sesión verificada</p>
        <h1>Elegí un área</h1>
        <div className="home-links">
          {session.roles?.includes("ADMIN") && <a className="button-link" href="#/admin/events">Administrar eventos</a>}
          {session.roles?.includes("ADMIN") && <a className="button-link" href="#/admin/judges">Administrar jurados</a>}
          {session.roles?.includes("JUDGE") && <a className="button-link" href="#/judge">Mi panel de jurado</a>}
          {session.roles?.length === 0 && <p>Tu cuenta no tiene un rol operativo asignado.</p>}
        </div>
      </div>
    </main>
  );
}
