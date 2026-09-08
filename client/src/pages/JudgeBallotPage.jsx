import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { apiRequest } from "../api/http.js";
import { Dialog } from "../components/Dialog.jsx";
import { Button } from "../components/Button.jsx";
import { ProgressBar } from "../components/ProgressBar.jsx";
import { StatusPill } from "../components/StatusPill.jsx";

const SCORE_ANCHOR = ["", "Muy malo", "Malo", "Regular", "Aceptable", "Correcto", "Muy correcto", "Bueno", "Muy bueno", "Excelente", "Excelente"];

function scoreAnchor(value) {
  return SCORE_ANCHOR[value] ?? "";
}

function groupScores(scores) {
  return scores.reduce((groups, score) => {
    const key = score.nightScheduleId;
    if (!groups[key]) {
      groups[key] = {
        nightScheduleId: key,
        troupeName: score.troupeName,
        presentationOrder: score.presentationOrder ?? 0,
        brandColor: score.brandColor || null,
        rubrics: {},
      };
    }
    if (!groups[key].rubrics[score.rubricId]) {
      groups[key].rubrics[score.rubricId] = {
        rubricId: score.rubricId,
        rubricName: score.rubricName,
        scores: [],
      };
    }
    groups[key].rubrics[score.rubricId].scores.push(score);
    return groups;
  }, {});
}

function getPendingItems(scores, details) {
  const scoresById = new Map(scores.map((score) => [score.id, score]));
  const source = details?.length > 0
    ? details
    : scores.filter((score) => score.evaluationState === "PENDING");

  return source.map((item, index) => {
    const score = scoresById.get(item.id) ?? item;
    return {
      id: item.id ?? score.id ?? `pending-${index}`,
      troupeName: score.troupeName ?? item.troupeName ?? "Comparsa sin identificar",
      rubricName: score.rubricName ?? item.rubricName ?? "Rubro sin identificar",
      itemName: score.itemName ?? item.name ?? item.itemName ?? item.code ?? "Ítem pendiente",
    };
  });
}

export function JudgeBallotPage({ ballotId, troupeId }) {
  const [ballot, setBallot] = useState(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) return "card";
    return "list";
  });
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [stagedScore, setStagedScore] = useState(null); // { scoreId, score, evaluationState }
  const [itemStatuses, setItemStatuses] = useState({}); // { [id]: { status: 'idle'|'saving'|'saved'|'error', errorMsg, lastAttempt } }
  const [notPresentedConfirm, setNotPresentedConfirm] = useState(null); // score item
  const [pendingDialogOpen, setPendingDialogOpen] = useState(false);
  const [incompleteDialog, setIncompleteDialog] = useState(null);
  const [submitConfirm, setSubmitConfirm] = useState(false);

  const scoreRefs = useRef(new Map());
  const troupeRefs = useRef(new Map());
  const submitButtonRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadBallot = async () => {
    if (!ballotId) return;
    try {
      const loaded = await apiRequest(`/api/v1/judge/ballots/${ballotId}`);
      if (!mountedRef.current) return;
      setBallot(loaded);
    } catch (error) {
      if (!mountedRef.current) return;
      const messages = {
        BALLOT_ACCESS_DENIED: "No tenés acceso a esta planilla.",
        BALLOT_NOT_FOUND: "La planilla no existe.",
      };
      setMessage(messages[error.code] ?? "No se pudo cargar la planilla.");
    }
  };

  useEffect(() => {
    void loadBallot();
  }, [ballotId]);

  useEffect(() => {
    if (!ballot || !troupeId) return;
    requestAnimationFrame(() => {
      troupeRefs.current.get(troupeId)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
  }, [ballot, troupeId]);

  const saveDecision = async (scoreId, evaluationState, score) => {
    if (!ballot) return;
    setItemStatuses((prev) => ({
      ...prev,
      [scoreId]: { status: "saving", lastAttempt: { evaluationState, score } },
    }));
    try {
      const saved = await apiRequest(`/api/v1/judge/ballots/${ballotId}/scores/${scoreId}`, {
        method: "PUT",
        body: JSON.stringify({ evaluationState, score }),
      });
      if (!mountedRef.current) return;
      setBallot((current) => current && {
        ...current,
        revision: saved.revision,
        scores: current.scores.map((item) => (item.id === scoreId ? { ...item, ...saved } : item)),
      });
      setItemStatuses((prev) => ({
        ...prev,
        [scoreId]: { status: "saved" },
      }));
      setMessage("Decisión confirmada en el servidor.");
    } catch (error) {
      if (!mountedRef.current) return;
      const errorMsg = error.code === "NETWORK_ERROR"
        ? "No hay conexión. Volvé a intentarlo para registrar la decisión."
        : "El servidor no pudo registrar la decisión.";
      setItemStatuses((prev) => ({
        ...prev,
        [scoreId]: { status: "error", errorMsg, lastAttempt: { evaluationState, score } },
      }));
      setMessage(errorMsg);
    }
  };

  const handleScoreClick = (scoreItem, value) => {
    if (stagedScore?.scoreId === scoreItem.id && stagedScore?.score === value) {
      // Second tap on the same number: confirm and save in situ
      const toSave = stagedScore;
      setStagedScore(null);
      void saveDecision(toSave.scoreId, "SCORED", toSave.score);
    } else {
      // First tap or changed number: preselect (staged)
      setStagedScore({ scoreId: scoreItem.id, score: value, evaluationState: "SCORED" });
    }
  };

  const handleRetry = (scoreId) => {
    const itemState = itemStatuses[scoreId];
    if (itemState?.lastAttempt) {
      void saveDecision(scoreId, itemState.lastAttempt.evaluationState, itemState.lastAttempt.score);
    }
  };

  const submit = async () => {
    if (!ballot || isSubmitting) return;
    setMessage("");
    const pendingItems = getPendingItems(ballot.scores);
    if (pendingItems.length > 0) {
      setIncompleteDialog(pendingItems);
      return;
    }
    setIsSubmitting(true);
    try {
      const submitted = await apiRequest(`/api/v1/judge/ballots/${ballotId}/submit`, { method: "POST" });
      if (!mountedRef.current) return;
      setBallot((current) => current && {
        ...current,
        status: submitted.status,
        revision: submitted.revision,
        scores: current.scores.map((score) => ({ ...score, status: "LOCKED" })),
      });
      setMessage("Planilla confirmada en el servidor.");
    } catch (error) {
      if (!mountedRef.current) return;
      if (error.code === "BALLOT_INCOMPLETE") {
        setIncompleteDialog(getPendingItems(ballot.scores, error.details));
      } else {
        setMessage(error.code === "NETWORK_ERROR"
          ? "No hay conexión. Volvé a intentarlo para confirmar la planilla."
          : "No se pudo confirmar la planilla.");
      }
    } finally {
      if (mountedRef.current) setIsSubmitting(false);
    }
  };

  // Keyboard navigation for desktop (RF-189)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        notPresentedConfirm ||
        pendingDialogOpen ||
        incompleteDialog ||
        submitConfirm ||
        !ballot
      ) {
        return;
      }
      const activeScore = ballot.scores[activeItemIndex];
      if (!activeScore || activeScore.evaluationState !== "PENDING" || ballot.status === "SUBMITTED") return;

      if (e.key >= "1" && e.key <= "9") {
        const val = Number(e.key);
        setStagedScore({ scoreId: activeScore.id, score: val, evaluationState: "SCORED" });
      } else if (e.key === "0") {
        setStagedScore({ scoreId: activeScore.id, score: 10, evaluationState: "SCORED" });
      } else if (e.key === "Enter") {
        if (stagedScore && stagedScore.scoreId === activeScore.id) {
          e.preventDefault();
          const { scoreId, evaluationState, score } = stagedScore;
          setStagedScore(null);
          void saveDecision(scoreId, evaluationState, score);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [ballot, activeItemIndex, stagedScore, notPresentedConfirm, pendingDialogOpen, incompleteDialog, submitConfirm]);

  if (!ballotId) {
    return (
      <main className="container">
        <div className="card">
          <h1>Planilla no seleccionada</h1>
          <a href="#/judge">Volver a mi panel</a>
        </div>
      </main>
    );
  }

  if (!ballot) {
    return (
      <main className="container">
        <div className="card">
          <h1>Planilla de evaluación</h1>
          <p role="status">{message || "Cargando planilla…"}</p>
        </div>
      </main>
    );
  }

  const readonly = ballot.status === "SUBMITTED";
  const groups = Object.values(groupScores(ballot.scores)).sort((left, right) => left.presentationOrder - right.presentationOrder);
  const resolved = ballot.scores.filter((score) => score.evaluationState !== "PENDING").length;
  const total = ballot.scores.length;
  const progress = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const scoreTotal = ballot.scores.reduce((sum, score) => sum + (typeof score.score === "number" ? score.score : 0), 0);
  const pendingScores = ballot.scores.filter((score) => score.evaluationState === "PENDING");
  const effectiveIndex = Math.min(Math.max(0, activeItemIndex), Math.max(0, total - 1));
  const activeScore = ballot.scores[effectiveIndex];

  const goToScore = (scoreId) => {
    const idx = ballot.scores.findIndex((s) => s.id === scoreId);
    if (idx !== -1) setActiveItemIndex(idx);
    requestAnimationFrame(() => {
      scoreRefs.current.get(scoreId)?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    });
  };

  const goToTroupe = (nightScheduleId) => {
    troupeRefs.current.get(nightScheduleId)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  const renderScoreDecision = (scoreItem, troupeName, rubricName) => {
    const isItemSaving = itemStatuses[scoreItem.id]?.status === "saving";
    const itemError = itemStatuses[scoreItem.id]?.status === "error" ? itemStatuses[scoreItem.id].errorMsg : null;

    if (scoreItem.evaluationState !== "PENDING") {
      return (
        <div className="score-locked-display">
          <div className="score-copy">
            <span className="score-copy-name">{scoreItem.itemName}</span>
          </div>
          <div
            className={`locked-score ${scoreItem.evaluationState === "NOT_PRESENTED" ? "not-presented" : ""}`}
            aria-label={`${troupeName}: ${scoreItem.itemName}, ${scoreItem.evaluationState === "NOT_PRESENTED" ? "No se presentó" : `puntuado ${scoreItem.score} ${scoreAnchor(scoreItem.score)}`}`}
          >
            <span aria-hidden="true">{scoreItem.evaluationState === "NOT_PRESENTED" ? "⊘" : "✓"}</span>
            <div>
              <strong>
                {scoreItem.evaluationState === "NOT_PRESENTED" ? "No se presentó" : <>{scoreItem.score} · {scoreAnchor(scoreItem.score)}</>}
              </strong>
              <small>Decisión bloqueada</small>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="score-actions" role="group" aria-label={`${troupeName}: ${scoreItem.itemName}`}>
        <div className="score-copy">
          <span className="score-copy-name">{scoreItem.itemName}</span>
        </div>

        {/* 1-10 radiogroup grid with double-tap in situ */}
        <div role="radiogroup" aria-label={`Puntuación para ${scoreItem.itemName}`} className="score-grid-v3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => {
            const isStaged = stagedScore?.scoreId === scoreItem.id && stagedScore?.score === val;
            return (
              <button
                key={val}
                type="button"
                role="radio"
                aria-checked={isStaged}
                aria-label={isStaged ? "Confirmar" : `${val} ${scoreAnchor(val)}`}
                disabled={readonly || scoreItem.status === "LOCKED" || isItemSaving}
                className={`score-option-btn ${isStaged ? "is-staged" : ""}`}
                onClick={() => handleScoreClick(scoreItem, val)}
              >
                <span className="score-num">{val}</span>
                <span className="score-anchor-text">{scoreAnchor(val)}</span>
                {isStaged && <span className="staged-confirm-badge">Confirmar</span>}
              </button>
            );
          })}
        </div>

        {/* Segregated "No se presentó" */}
        <div className="not-presented-section">
          <p className="not-presented-hint">Marcar exclusivamente si la comparsa no se presentó o no completó este rubro.</p>
          <button
            type="button"
            className="not-presented-btn"
            disabled={readonly || scoreItem.status === "LOCKED" || isItemSaving}
            onClick={() => setNotPresentedConfirm({
              id: scoreItem.id,
              troupeName,
              rubricName,
              itemName: scoreItem.itemName,
            })}
          >
            No se presentó
          </button>
        </div>

        {/* Granular per-item network status & retry */}
        {isItemSaving && (
          <p className="item-saving-copy" role="status">Guardando decisión…</p>
        )}
        {itemError && (
          <div className="item-status-error" role="alert">
            <span>Fallo al guardar ítem</span>
            <button
              type="button"
              className="item-retry-btn"
              onClick={() => handleRetry(scoreItem.id)}
            >
              Reintentar
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="judge-ballot-page judge-operation-shell" data-layer="instrument">
      <div className="ballot-layout">
        <aside className="ballot-sidebar" aria-label="Comparsas">
          <nav>
            <ul>
              {groups.map((group) => {
                const groupTotal = Object.values(group.rubrics).reduce((n, r) => n + r.scores.length, 0);
                const groupResolved = Object.values(group.rubrics).reduce((n, r) => n + r.scores.filter((s) => s.evaluationState !== "PENDING").length, 0);
                return (
                  <li key={group.nightScheduleId}>
                    <button
                      type="button"
                      className="ballot-sidebar-item"
                      onClick={() => {
                        goToTroupe(group.nightScheduleId);
                        const firstScore = Object.values(group.rubrics)[0]?.scores[0];
                        if (firstScore) goToScore(firstScore.id);
                      }}
                    >
                      {group.brandColor && (
                        <span
                          className="troupe-color-indicator"
                          style={{
                            inlineSize: "10px",
                            blockSize: "10px",
                            borderRadius: "50%",
                            backgroundColor: group.brandColor,
                            display: "inline-block",
                            marginInlineEnd: "8px",
                          }}
                          aria-hidden="true"
                        />
                      )}
                      <span className="ballot-sidebar-name">{group.presentationOrder}. {group.troupeName}</span>
                      <span className={`ballot-sidebar-status ${groupResolved === groupTotal ? "is-done" : groupResolved > 0 ? "is-progress" : ""}`}>
                        {groupResolved}/{groupTotal}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <div className="ballot-main">
          <header className="ballot-header">
            <div>
              <a className="back-link" href="#/judge">← Comparsas</a>
              <p className="eyebrow">Planilla de jurado</p>
              <h1>{ballot.nightName}</h1>
              <p>{ballot.specialtyName} · {groups.length} comparsa{groups.length === 1 ? "" : "s"}</p>
            </div>
            <div className="ballot-header-status" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <button
                type="button"
                className="secondary view-toggle-btn"
                onClick={() => setViewMode((prev) => (prev === "card" ? "list" : "card"))}
                aria-label={viewMode === "card" ? "Ver lista completa" : "Ver tarjeta única"}
              >
                {viewMode === "card" ? "Ver lista completa" : "Ver tarjeta única"}
              </button>
              <StatusPill status={ballot.status} />
            </div>
          </header>

          <section className="ballot-progress" aria-label="Progreso de la planilla">
            <ProgressBar
              value={resolved}
              max={total}
              label="Progreso"
              sublabel={`${resolved} / ${total} (${progress}%) · ${ballot.specialtyName}`}
            />
          </section>

          <p className="feedback" role="status" aria-live="polite">{message}</p>

          {readonly && (
            <section className="readonly-notice">
              <span aria-hidden="true">🔒</span>
              <div>
                <strong>Planilla confirmada</strong>
                <p>Esta planilla es solo para consulta y ya no puede modificarse.</p>
              </div>
            </section>
          )}

          <div className="ballot-workspace">
            {/* Card Mode (Tarjeta a tarjeta) */}
            {viewMode === "card" && activeScore && (
              <section className="ballot-card-mode" aria-label={`Evaluación: ${activeScore.troupeName} - ${activeScore.itemName}`}>
                <div className="ballot-card-header">
                  {activeScore.brandColor && (
                    <div
                      className="troupe-brand-stripe"
                      style={{ backgroundColor: activeScore.brandColor }}
                      aria-hidden="true"
                    />
                  )}
                  <p className="eyebrow">Salida {activeScore.presentationOrder} · {ballot.specialtyName}</p>
                  <h2>{activeScore.troupeName}</h2>
                  <p className="card-rubric-name">{activeScore.rubricName}</p>
                </div>

                <div className="card-item-body">
                  <h3 className="card-item-title">{activeScore.itemName}</h3>
                  <p className="rubric-instruction">Seleccioná una puntuación para este criterio.</p>
                  {renderScoreDecision(activeScore, activeScore.troupeName, activeScore.rubricName)}
                </div>
              </section>
            )}

            {/* List Mode (Lista completa jerárquica) */}
            {viewMode === "list" && (
              <section className="ballot-list" aria-label="Puntuaciones por comparsa">
                {groups.map((group) => (
                  <article
                    className="ballot-troupe"
                    key={group.nightScheduleId}
                    style={group.brandColor ? { borderInlineStartColor: group.brandColor } : undefined}
                    ref={(el) => {
                      if (el) troupeRefs.current.set(group.nightScheduleId, el);
                      else troupeRefs.current.delete(group.nightScheduleId);
                    }}
                  >
                    {group.brandColor && (
                      <div
                        className="troupe-brand-stripe"
                        style={{ backgroundColor: group.brandColor }}
                        aria-hidden="true"
                      />
                    )}
                    <header>
                      <p className="eyebrow">Salida {group.presentationOrder}</p>
                      <h2>{group.troupeName}</h2>
                    </header>
                    {Object.values(group.rubrics).map((rubric) => (
                      <section className="ballot-rubric" key={rubric.rubricId}>
                        <h3>{rubric.rubricName}</h3>
                        <p className="rubric-instruction">Seleccioná una puntuación para este criterio.</p>
                        {rubric.scores.map((score) => (
                          <div
                            className={`score-row score-state-${score.evaluationState.toLowerCase()}`}
                            key={score.id}
                            ref={(el) => {
                              if (el) scoreRefs.current.set(score.id, el);
                              else scoreRefs.current.delete(score.id);
                            }}
                          >
                            {renderScoreDecision(score, group.troupeName, rubric.rubricName)}
                          </div>
                        ))}
                      </section>
                    ))}
                  </article>
                ))}
              </section>
            )}
          </div>

          <footer className="ballot-footer">
            <a className="secondary button-link" href="#/judge">← Comparsas</a>
            <span className="save-indicator" role="status" aria-live="polite">
              {message === "Decisión confirmada en el servidor." ? (
                <><span aria-hidden="true">✓</span> Guardado</>
              ) : message?.includes("No hay conexión") ? (
                <><span aria-hidden="true">⚠</span> Error de guardado — reintentá</>
              ) : null}
            </span>
            {!readonly && (
              <button
                ref={submitButtonRef}
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  const pendingItems = getPendingItems(ballot.scores);
                  if (pendingItems.length > 0) setIncompleteDialog(pendingItems);
                  else setSubmitConfirm(true);
                }}
              >
                {isSubmitting ? "Confirmando…" : "Confirmar planilla"}
              </button>
            )}
            {readonly && (
              <section className="locked-sheet" aria-label="Planilla confirmada">
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>Planilla confirmada</strong>
                  <p>Total registrado: {scoreTotal} puntos · Evaluación cerrada</p>
                </div>
              </section>
            )}
          </footer>
        </div>
      </div>

      {/* Fixed bottom navigation bar (RF-188) */}
      {!readonly && (
        <nav className="ballot-bottom-bar" aria-label="Navegación de planilla">
          <div className="bottom-bar-content">
            <div className="bottom-bar-nav-btns">
              <button
                type="button"
                className="nav-btn prev-btn"
                disabled={effectiveIndex <= 0}
                onClick={() => setActiveItemIndex((prev) => Math.max(0, prev - 1))}
                aria-label="Ítem anterior"
              >
                ← Anterior
              </button>
              <span className="nav-counter" aria-live="polite">
                Ítem {effectiveIndex + 1} de {total}
              </span>
              <button
                type="button"
                className="nav-btn next-btn"
                disabled={effectiveIndex >= total - 1}
                onClick={() => setActiveItemIndex((prev) => Math.min(total - 1, prev + 1))}
                aria-label="Ítem siguiente"
              >
                Siguiente →
              </button>
            </div>
            <button
              type="button"
              className="faltantes-btn"
              onClick={() => setPendingDialogOpen(true)}
            >
              Faltantes ({pendingScores.length})
            </button>
          </div>
        </nav>
      )}

      {/* Faltantes Dialog (RF-188) */}
      <Dialog
        isOpen={pendingDialogOpen}
        onClose={() => setPendingDialogOpen(false)}
        title="Ítems pendientes"
        description="Seleccioná un ítem para dirigirte a él:"
      >
        <ul className="pending-dialog-list" aria-label="Ítems pendientes">
          {pendingScores.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="pending-item-jump-btn"
                onClick={() => {
                  goToScore(item.id);
                  setPendingDialogOpen(false);
                }}
              >
                <span className="pending-troupe">{item.troupeName}</span>
                <span className="pending-rubric">{item.rubricName}</span>
                <strong className="pending-item-name">{item.itemName}</strong>
              </button>
            </li>
          ))}
          {pendingScores.length === 0 && (
            <li>
              <p>¡No quedan ítems pendientes! Podés confirmar la planilla.</p>
            </li>
          )}
        </ul>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
          <Button variant="secondary" onClick={() => setPendingDialogOpen(false)}>
            Cerrar
          </Button>
        </div>
      </Dialog>

      {/* Incomplete Ballot Dialog (attempted submit with pendings) */}
      <Dialog
        isOpen={Boolean(incompleteDialog)}
        onClose={() => setIncompleteDialog(null)}
        title="Faltan decisiones por resolver"
        description="Asigná una puntuación de 1 a 10 o marcá No se presentó en cada ítem antes de confirmar."
      >
        <ul className="pending-dialog-list" aria-label="Ítems pendientes">
          {incompleteDialog?.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="pending-item-jump-btn"
                onClick={() => {
                  goToScore(item.id);
                  setIncompleteDialog(null);
                }}
              >
                <span className="pending-troupe">{item.troupeName}</span>
                <span className="pending-rubric">{item.rubricName}</span>
                <strong className="pending-item-name">{item.itemName}</strong>
              </button>
            </li>
          ))}
        </ul>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
          <Button variant="secondary" onClick={() => setIncompleteDialog(null)}>
            Volver a la planilla
          </Button>
        </div>
      </Dialog>

      {/* Segregated "No se presentó" Modal (RF-186) */}
      <Dialog
        isOpen={Boolean(notPresentedConfirm)}
        onClose={() => setNotPresentedConfirm(null)}
        title="Confirmación de voto"
        description="Una vez confirmada, esta decisión no podrá modificarse."
      >
        {notPresentedConfirm && (
          <div className="not-presented-dialog-content">
            <p><strong>{notPresentedConfirm.troupeName}</strong></p>
            <p>{notPresentedConfirm.rubricName} — {notPresentedConfirm.itemName}</p>
            <p style={{ margin: "1rem 0", padding: "0.75rem", background: "var(--warning-bg)", border: "1px solid var(--warning-border)", borderRadius: "var(--radius-sm)", color: "var(--warning-text)" }}>
              Esta acción registrará 0 (cero) puntos de manera inmutable.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
              <Button variant="secondary" onClick={() => setNotPresentedConfirm(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  const target = notPresentedConfirm;
                  setNotPresentedConfirm(null);
                  void saveDecision(target.id, "NOT_PRESENTED", 0);
                }}
              >
                Confirmar
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Final Submit Confirmation Modal */}
      <Dialog
        isOpen={submitConfirm}
        onClose={() => setSubmitConfirm(false)}
        title="Cierre definitivo"
        description="Una vez confirmada, esta planilla no podrá modificarse."
      >
        <div className="submit-dialog-content">
          <p className="eyebrow">Confirmar planilla</p>
          <p>Estás por cerrar la evaluación de <strong>{groups[0]?.troupeName ?? ballot.nightName}</strong>.</p>
          <p className="confirm-score-display" style={{ margin: "1rem 0", fontSize: "1.25rem" }}>
            Total registrado: <strong>{scoreTotal} puntos</strong>
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
            <Button variant="secondary" onClick={() => setSubmitConfirm(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setSubmitConfirm(false);
                void submit();
              }}
              disabled={isSubmitting}
            >
              Confirmar y cerrar
            </Button>
          </div>
        </div>
      </Dialog>
    </main>
  );
}
