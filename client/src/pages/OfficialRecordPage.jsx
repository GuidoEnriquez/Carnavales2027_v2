import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell.jsx";
import { apiRequest } from "../api/http.js";
import { useSession } from "../auth/session-context.jsx";

export function OfficialRecordPage() {
  const session = useSession();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
      return params.get("eventId") || "";
    }
    return "";
  });
  const [recordData, setRecordData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canCertify = session?.roles?.some((r) => ["SCRUTINEER", "ESCRIBANO"].includes(r));

  // Cargar lista de eventos
  useEffect(() => {
    let current = true;
    apiRequest("/api/v1/results/events")
      .then((data) => {
        if (!current) return;
        const list = Array.isArray(data) ? data : data?.events || [];
        setEvents(list);
        if (list.length > 0) {
          setSelectedEventId((prev) => prev || list[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        // Fallback a ruta de penalizaciones si la de resultados no responde
        apiRequest("/api/v1/penalties/events")
          .then((data) => {
            if (!current) return;
            const list = Array.isArray(data) ? data : [];
            setEvents(list);
            if (list.length > 0) {
              setSelectedEventId((prev) => prev || list[0].id);
            } else {
              setLoading(false);
            }
          })
          .catch(() => {
            if (current) setLoading(false);
          });
      });
    return () => { current = false; };
  }, []);

  // Cargar acta oficial del evento seleccionado
  useEffect(() => {
    if (!selectedEventId) {
      setRecordData(null);
      setLoading(false);
      return;
    }
    let current = true;
    setLoading(true);
    setError("");
    setMessage("");
    apiRequest(`/api/v1/events/${selectedEventId}/scrutiny-record`)
      .then((data) => {
        if (!current) return;
        setRecordData(data);
      })
      .catch((err) => {
        if (!current) return;
        if (err.code === "OFFICIAL_RECORD_NOT_FOUND") {
          setRecordData(null);
        } else {
          setError(err.message || "No se pudo cargar el acta oficial.");
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, [selectedEventId]);

  const handleCertify = async () => {
    if (!selectedEventId || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await apiRequest(`/api/v1/events/${selectedEventId}/scrutiny-record`, {
        method: "POST",
      });
      setRecordData(response.record ? { ...response.record, integrityVerified: response.integrityVerified } : response);
      setMessage("✓ Acta Oficial emitida y sellada criptográficamente con éxito.");
    } catch (err) {
      if (err.code === "OFFICIAL_RECORD_EMISSION_FORBIDDEN_FOR_ADMIN") {
        setError("Por normativa de segregación de funciones, la emisión corresponde exclusivamente a Escrutinio o Escribanía.");
      } else if (err.code === "RESULTS_NOT_RELEASED") {
        setError("Los resultados de este evento aún no han sido liberados por Escrutinio.");
      } else if (err.code === "TIE_BREAKER_PENDING") {
        setError("Existe un empate en Mejor Comparsa pendiente de resolución o sorteo ceremonial.");
      } else {
        setError(err.message || "Error al certificar el acta oficial.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const currentEvent = events.find((e) => e.id === selectedEventId);
  const payload = recordData?.payload;

  return (
    <PageShell layer="instrument" className="official-record-page">
      {/* Barra de control y navegación en pantalla (se oculta al imprimir) */}
      <section className="record-controls-panel no-print" aria-label="Controles del acta">
        <div className="record-controls-header">
          <a className="secondary button-link" href="#/admin/results">← Volver a Escrutinio</a>
          <div className="record-event-selector">
            <label htmlFor="record-event-select">Competencia:</label>
            <select
              id="record-event-select"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              disabled={loading || busy}
            >
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>{evt.name}</option>
              ))}
            </select>
          </div>
          {recordData && (
            <button type="button" className="primary-action" onClick={handlePrint}>
              🖨️ Imprimir / Exportar PDF
            </button>
          )}
        </div>
        <p className="workflow-context">Paso 4 de 4 · Emisión y consulta del Acta Oficial</p>
        {message && <p className="feedback-message is-success" role="status">{message}</p>}
        {error && <p className="feedback-message is-error" role="alert">{error}</p>}
      </section>

      {loading && <p className="record-loading" role="status">Cargando datos del acta…</p>}

      {/* Estado si aún no fue emitida el acta */}
      {!loading && selectedEventId && !recordData && (
        <section className="record-pending-card no-print" aria-label="Estado de emisión de acta">
          <span className="pending-icon" aria-hidden="true">📜</span>
          <h2>Acta Oficial no emitida</h2>
          <p>El evento <strong>{currentEvent?.name || "seleccionado"}</strong> no cuenta aún con un Acta Notarial definitiva registrada.</p>
          {canCertify ? (
            <div className="record-certify-box">
              <p>Como autoridad habilitada de <strong>Escrutinio / Escribanía</strong>, podés proceder al cierre solemne y certificación criptográfica.</p>
              <button
                type="button"
                className="primary-action certify-btn"
                disabled={busy}
                onClick={handleCertify}
              >
                {busy ? "Certificando y sellando…" : "Certificar y emitir Acta Oficial"}
              </button>
            </div>
          ) : (
            <div className="record-admin-notice">
              <p className="admin-release-notice">
                🔒 Por normativa de segregación de funciones, la certificación y emisión del Acta Oficial corresponde exclusivamente a las autoridades de <strong>Escrutinio</strong> o <strong>Escribanía</strong>.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Documento Notarial Formal (apto para pantalla y @media print) */}
      {!loading && selectedEventId && recordData && payload && (
        <article className="official-record-document">
          <header className="record-doc-header">
            <div className="record-header-republic">
              <p className="republic-text">REPÚBLICA ARGENTINA — PROVINCIA DE CORRIENTES</p>
              <p className="municipality-text">MUNICIPALIDAD DE GOYA — COMISIÓN CENTRAL DEL CARNAVAL</p>
            </div>
            <h1 className="record-title">ACTA NOTARIAL DE ESCRUTINIO DEFINITIVO</h1>
            <p className="record-number-badge">{recordData.record_number}</p>
          </header>

          <section className="record-seal-banner" aria-label="Sello de Integridad Digital">
            <div className="seal-info">
              <span className="seal-badge">✓ INTEGRIDAD DIGITAL VERIFICADA</span>
              <p className="seal-hash-label">Firma canónica SHA-256 (RFC 8785):</p>
              <code className="seal-hash">{recordData.record_hash}</code>
            </div>
            <div className="seal-meta">
              <p><strong>Fecha/Hora Oficial:</strong> {new Date(payload.certifiedAt || recordData.created_at).toLocaleString("es-AR")}</p>
              <p><strong>Autoridad Certificante:</strong> {payload.certifiedBy?.name} ({payload.certifiedBy?.role})</p>
            </div>
          </section>

          <section className="record-intro-narrative">
            <p>
              En la ciudad de Goya, Provincia de Corrientes, a los {new Date(payload.certifiedAt || recordData.created_at).toLocaleDateString("es-AR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}, comparecen ante mí las autoridades de Escrutinio y fiscalización del Carnaval Oficial para dar formal constancia y fe pública del resultado definitivo del concurso denominado <strong>«{payload.event?.name}»</strong>, habiéndose computado íntegramente las planillas de votación confirmadas por el cuerpo de jurados e incorporado las deducciones por penalizaciones reglamentarias determinadas por el Comisariato de Pista.
            </p>
          </section>

          {/* Comparsas Participantes */}
          <section className="record-section" aria-label="Comparsas participantes">
            <h2>1. Comparsas Participantes</h2>
            <ul className="record-troupes-list">
              {payload.troupes?.map((t) => (
                <li key={t.troupeId}><strong>{t.troupeName}</strong> — Categoría: {t.categoryName}</li>
              ))}
            </ul>
          </section>

          {/* Nómina de Jurados */}
          <section className="record-section" aria-label="Cuerpo de jurados">
            <h2>2. Nómina del Cuerpo de Jurados</h2>
            <div className="record-judges-grid">
              {payload.judges?.map((j, idx) => (
                <div className="record-judge-item" key={idx}>
                  <strong>{j.judgeName}</strong>
                  <span>Rubro evaluado: {j.specialtyName}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Ganadores por Rubro Artístico */}
          <section className="record-section" aria-label="Premios por rubro">
            <h2>3. Resultados Oficiales por Rubro Artístico</h2>
            <p className="record-rubrics-note">Conforme al Reglamento, los premios por rubro artístico individual premian la excelencia técnica en pista y se otorgan según el puntaje consolidado de sus respectivos jurados.</p>
            <table className="record-table">
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Rubro Artístico</th>
                  <th scope="col">Comparsa Ganadora</th>
                  <th scope="col" className="text-end">Puntaje</th>
                </tr>
              </thead>
              <tbody>
                {payload.rubricRankings?.map((rubric) => {
                  const winner = rubric.winners?.[0];
                  return (
                    <tr key={rubric.rubricId}>
                      <td className="code-cell">{rubric.rubricCode}</td>
                      <td><strong>{rubric.rubricName}</strong></td>
                      <td>{winner ? winner.troupeName : "Sin ganador"}</td>
                      <td className="text-end">{winner ? `${winner.totalScore} pts` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* Ranking Definitivo de Mejor Comparsa */}
          <section className="record-section" aria-label="Ranking de Mejor Comparsa">
            <h2>4. Ranking General Definitivo — Mejor Comparsa</h2>
            <p className="record-overall-note">El título de Mejor Comparsa se determina por la suma de rubros nominativos acumulados, con deducción de las penalizaciones reglamentarias aplicadas por el Comisariato.</p>
            <table className="record-table overall-table">
              <thead>
                <tr>
                  <th scope="col" className="text-center">Pos.</th>
                  <th scope="col">Comparsa</th>
                  <th scope="col" className="text-end">Puntaje Bruto</th>
                  <th scope="col" className="text-end">Penalizaciones</th>
                  <th scope="col" className="text-end highlight">Puntaje Neto Final</th>
                </tr>
              </thead>
              <tbody>
                {payload.overallRanking?.map((troupe) => (
                  <tr key={troupe.troupeId} className={troupe.rank === 1 ? "winner-row" : ""}>
                    <td className="text-center"><strong>{troupe.rank}°</strong></td>
                    <td>
                      <strong>{troupe.troupeName}</strong>
                      {troupe.rank === 1 && <span className="winner-tag">CAMPEONA</span>}
                    </td>
                    <td className="text-end">{troupe.grossScore} pts</td>
                    <td className="text-end penalty-cell">
                      {troupe.totalPenalties > 0 ? `−${troupe.totalPenalties} pts` : "0 pts"}
                    </td>
                    <td className="text-end highlight"><strong>{troupe.netScore} pts</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Memoria de Desempates si aplicó */}
          {payload.bestTroupe?.tieBreaker && (
            <section className="record-section record-tiebreaker-memo" aria-label="Memoria de desempate">
              <h2>5. Constancia Reglamentaria de Desempate</h2>
              <p>
                Ante igualdad de puntaje neto en el primer puesto, se aplicaron los mecanismos previstos en el Artículo correspondiente del Reglamento:
              </p>
              <ul>
                {payload.bestTroupe.tieBreaker.appliedCriteria?.map((crit, idx) => (
                  <li key={idx}>
                    {crit === "CRITERION_1_RUBRIC_WINS" && "Criterio 1: Mayor cantidad de rubros nominativos ganados."}
                    {crit === "CRITERION_2_BATTERIE_SCORE" && "Criterio 2: Comparsa ganadora en el rubro Mejor Batería."}
                    {crit === "CRITERION_3_CEREMONIAL_DRAW" && "Criterio 3: Sorteo Ceremonial público con generación criptográfica auditada."}
                  </li>
                ))}
              </ul>
              {payload.bestTroupe.tieBreaker.ceremonialDraw && (
                <div className="ceremonial-draw-memo">
                  <p><strong>Registro de Sorteo Ceremonial:</strong> ID {payload.bestTroupe.tieBreaker.ceremonialDraw.auditEventId}</p>
                  <p><strong>Semilla / Nonce:</strong> <code>{payload.bestTroupe.tieBreaker.ceremonialDraw.seed}</code></p>
                </div>
              )}
            </section>
          )}

          {/* Cuadro de Rúbricas y Firmas Hológrafas */}
          <section className="record-signatures-section" aria-label="Firmas reglamentarias">
            <p className="signatures-intro">En prueba de conformidad y previa lectura, firman al pie las autoridades actuantes y los representantes legales acreditados de cada comparsa:</p>
            <div className="signatures-grid">
              <div className="signature-slot">
                <div className="sig-line" />
                <p className="sig-name">{payload.certifiedBy?.name}</p>
                <p className="sig-role">{payload.certifiedBy?.role === "ESCRIBANO" ? "Escribano Público Titular" : "Escrutador Mayor"}</p>
              </div>
              <div className="signature-slot">
                <div className="sig-line" />
                <p className="sig-name">Presidente de Comisión</p>
                <p className="sig-role">Coordinación General Goya 2027</p>
              </div>
              {payload.troupes?.map((t) => (
                <div className="signature-slot" key={t.troupeId}>
                  <div className="sig-line" />
                  <p className="sig-name">Delegado / Representante</p>
                  <p className="sig-role">{t.troupeName}</p>
                </div>
              ))}
            </div>
          </section>
        </article>
      )}
    </PageShell>
  );
}
