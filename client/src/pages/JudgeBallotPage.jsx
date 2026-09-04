import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { apiRequest } from "../api/http.js";

function groupScores(scores) {
  return scores.reduce((groups, score) => {
    const key = score.nightScheduleId;
    if (!groups[key]) groups[key] = { ...score, rubrics: {} };
    if (!groups[key].rubrics[score.rubricId]) groups[key].rubrics[score.rubricId] = { ...score, scores: [] };
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
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [pendingDialog, setPendingDialog] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const pendingDialogRef = useRef(null);
  const confirmDialogRef = useRef(null);
  const submitConfirmDialogRef = useRef(null);
  const submitButtonRef = useRef(null);
  const scoreRefs = useRef(new Map());
  const troupeRefs = useRef(new Map());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const dialog = pendingDialogRef.current;
    if (!dialog) return;

    if (pendingDialog?.length > 0 && !dialog.open) {
      dialog.showModal();
      dialog.querySelector("[data-pending-dialog-close]")?.focus();
    } else if (!pendingDialog && dialog.open) {
      dialog.close();
    }
  }, [pendingDialog]);

  useEffect(() => {
    const dialog = confirmDialogRef.current;
    if (!dialog) return;

    if (confirmModal && !dialog.open) {
      dialog.showModal();
    } else if (!confirmModal && dialog.open) {
      dialog.close();
    }
  }, [confirmModal]);

  useLayoutEffect(() => {
    const dialog = submitConfirmDialogRef.current;
    if (!dialog) return;
    if (submitConfirm && !dialog.open) dialog.showModal();
    else if (!submitConfirm && dialog.open) dialog.close();
  }, [submitConfirm]);

  const closePendingDialog = () => {
    const dialog = pendingDialogRef.current;
    if (dialog?.open) dialog.close();
    else {
      setPendingDialog(null);
      submitButtonRef.current?.focus();
    }
  };

  const handlePendingDialogClose = () => {
    setPendingDialog(null);
    submitButtonRef.current?.focus();
  };

  const goToPendingItem = (scoreId) => {
    setPendingDialog(null);
    requestAnimationFrame(() => scoreRefs.current.get(scoreId)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  const goToTroupe = (troupeId) => {
    troupeRefs.current.get(troupeId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
    requestAnimationFrame(() => troupeRefs.current.get(troupeId)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [ballot, troupeId]);

  const saveDecision = async (scoreId, evaluationState, score) => {
    if (!ballot || busy) return;
    setBusy(scoreId);
    setMessage("");
    try {
      const saved = await apiRequest(`/api/v1/judge/ballots/${ballotId}/scores/${scoreId}`, {
        method: "PUT",
        body: JSON.stringify({ evaluationState, score }),
      });
      if (!mountedRef.current) return;
      setBallot((current) => current && {
        ...current,
        revision: saved.revision,
        scores: current.scores.map((item) => item.id === scoreId ? { ...item, ...saved } : item),
      });
      setMessage("Decisión confirmada en el servidor.");
    } catch (error) {
      setMessage(error.code === "NETWORK_ERROR"
        ? "No hay conexión. Volvé a intentarlo para registrar la decisión."
        : "El servidor no pudo registrar la decisión.");
    } finally {
      setBusy("");
    }
  };

  const submit = async () => {
    if (!ballot || busy) return;
    setMessage("");
    const pendingItems = getPendingItems(ballot.scores);
    if (pendingItems.length > 0) {
      setPendingDialog(pendingItems);
      return;
    }
    setBusy("submit");
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
      if (error.code === "BALLOT_INCOMPLETE") {
        setPendingDialog(getPendingItems(ballot.scores, error.details));
      } else {
        setMessage(error.code === "NETWORK_ERROR"
          ? "No hay conexión. Volvé a intentarlo para confirmar la planilla."
          : "No se pudo confirmar la planilla.");
      }
    } finally {
      setBusy("");
    }
  };

  if (!ballotId) {
    return <main className="container"><div className="card"><h1>Planilla no seleccionada</h1><a href="#/judge">Volver a mi panel</a></div></main>;
  }

  if (!ballot) {
    return <main className="container"><div className="card"><h1>Planilla de evaluación</h1><p role="status">{message || "Cargando planilla…"}</p></div></main>;
  }

  const readonly = ballot.status === "SUBMITTED";
  const groups = Object.values(groupScores(ballot.scores)).sort((left, right) => left.presentationOrder - right.presentationOrder);
  const resolved = ballot.scores.filter((score) => score.evaluationState !== "PENDING").length;
  const total = ballot.scores.length;
  const progress = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const scoreTotal = ballot.scores.reduce((sum, score) => sum + (typeof score.score === "number" ? score.score : 0), 0);

  return <main className="judge-ballot-page judge-operation-shell">
    <header className="ballot-header">
      <div><a className="back-link" href="#/judge">← Comparsas</a><p className="eyebrow">Planilla de jurado</p><h1>{ballot.nightName}</h1><p>{ballot.specialtyName} · {groups.length} comparsa{groups.length === 1 ? "" : "s"}</p></div>
      <div className="ballot-header-status">
        <span className={`status-pill ballot-status-${ballot.status.toLowerCase()}`}>
          {ballot.status === "SUBMITTED" ? "✓ Confirmada" : ballot.status === "REOPENED" ? "Reabierta" : "En carga"}
        </span>
      </div>
    </header>
    <section className="ballot-progress" aria-label="Progreso de la planilla"><div><span>Progreso</span><strong>{resolved} / {total}</strong></div><div className="progress-track"><span style={{ inlineSize: `${progress}%` }} /></div><p>{progress}% completado · {ballot.specialtyName}</p></section>
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
      <section className="ballot-list" aria-label="Puntuaciones por comparsa">
        {groups.map((group) => <article className="ballot-troupe" key={group.nightScheduleId} ref={(element) => { if (element) troupeRefs.current.set(group.nightScheduleId, element); else troupeRefs.current.delete(group.nightScheduleId); }}>
          <header><p className="eyebrow">Salida {group.presentationOrder}</p><h2>{group.troupeName}</h2></header>
          {Object.values(group.rubrics).map((rubric) => <section className="ballot-rubric" key={rubric.rubricId}>
            <h3>{rubric.rubricName}</h3>
            <p className="rubric-instruction">Seleccioná una puntuación para este criterio.</p>
            {rubric.scores.map((score) => <div className={`score-row score-state-${score.evaluationState.toLowerCase()}`} key={score.id} ref={(element) => { if (element) scoreRefs.current.set(score.id, element); else scoreRefs.current.delete(score.id); }}>
              {score.evaluationState !== "PENDING" ? <div className={`locked-score ${score.evaluationState === "NOT_PRESENTED" ? "not-presented" : ""}`} aria-label={`${group.troupeName}: ${score.itemName}, ${score.evaluationState === "NOT_PRESENTED" ? "No se presentó" : `puntuado ${score.score}`}`}><span aria-hidden="true">{score.evaluationState === "NOT_PRESENTED" ? "⊘" : "✓"}</span><strong>{score.evaluationState === "NOT_PRESENTED" ? "No se presentó" : score.score}</strong><small>Decisión bloqueada</small></div> : <div className="score-actions" role="group" aria-label={`${group.troupeName}: ${score.itemName}`}>
                <div className="score-grid">{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => <button key={value} type="button" disabled={readonly || score.status === "LOCKED" || Boolean(busy)} onClick={() => setConfirmModal({ scoreId: score.id, evaluationState: "SCORED", score: value, itemContext: { troupeName: group.troupeName, rubricName: rubric.rubricName, itemName: score.itemName } })}>{value}</button>)}</div>
                <button type="button" className="not-presented-action" disabled={readonly || score.status === "LOCKED" || Boolean(busy)} onClick={() => setConfirmModal({ scoreId: score.id, evaluationState: "NOT_PRESENTED", score: 0, itemContext: { troupeName: group.troupeName, rubricName: rubric.rubricName, itemName: score.itemName } })}>No se presentó</button>
              </div>}
            </div>)}
          </section>)}
        </article>)}
      </section>
    </div>
    <footer className="ballot-footer">
      <a className="secondary button-link" href="#/judge">← Anterior</a>
      <span className="save-indicator"><span aria-hidden="true">●</span> Guardado local</span>
      {!readonly && <button ref={submitButtonRef} type="button" disabled={Boolean(busy)} onClick={() => {
        const pendingItems = getPendingItems(ballot.scores);
        if (pendingItems.length > 0) setPendingDialog(pendingItems);
        else setSubmitConfirm(true);
      }}>{busy === "submit" ? "Confirmando…" : "Confirmar planilla"}</button>}
      {readonly && <section className="locked-sheet" aria-label="Planilla confirmada"><span aria-hidden="true">✓</span><div><strong>Planilla confirmada</strong><p>Total registrado: {scoreTotal} puntos · Evaluación cerrada</p></div></section>}
    </footer>
    <dialog
      ref={pendingDialogRef}
      className="pending-dialog"
      aria-modal="true"
      aria-labelledby="pending-dialog-title"
      aria-describedby="pending-dialog-description"
      onCancel={(event) => { event.preventDefault(); closePendingDialog(); }}
      onClose={handlePendingDialogClose}
    >
      {pendingDialog && <div className="pending-dialog-content">
        <p className="eyebrow">Planilla incompleta</p>
        <h2 id="pending-dialog-title">Faltan decisiones por resolver</h2>
        <p id="pending-dialog-description">Asigná una puntuación de 1 a 10 o marcá No se presentó en cada ítem antes de confirmar.</p>
        <ul className="pending-dialog-list" aria-label="Ítems pendientes">
          {pendingDialog.map((item) => <li key={item.id}><button type="button" onClick={() => goToPendingItem(item.id)}><span>{item.troupeName}</span><span>{item.rubricName}</span><strong>{item.itemName}</strong></button></li>)}
        </ul>
        <div className="pending-dialog-actions"><button data-pending-dialog-close type="button" onClick={closePendingDialog}>Volver a la planilla</button></div>
      </div>}
    </dialog>
    <dialog
      ref={confirmDialogRef}
      className="pending-dialog confirm-dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onCancel={(event) => { event.preventDefault(); setConfirmModal(null); }}
    >
      {confirmModal && <div className="pending-dialog-content">
        <p className="eyebrow">Confirmación de voto</p>
        <h2 id="confirm-modal-title">¿Confirmás esta decisión?</h2>
        <p><strong>{confirmModal.itemContext.troupeName}</strong></p>
        <p>{confirmModal.itemContext.rubricName} - {confirmModal.itemContext.itemName}</p>
        <p className="confirm-score-display">{confirmModal.evaluationState === "NOT_PRESENTED" ? "Confirmar 0 - No se presentó" : <>Puntuación: <strong>{confirmModal.score}</strong></>}</p>
        <p className="sync-warning">Una vez confirmada, esta decisión no podrá modificarse.</p>
        <div className="pending-dialog-actions modal-actions">
          <button type="button" className="secondary" onClick={() => setConfirmModal(null)} disabled={Boolean(busy)}>Cancelar</button>
          <button type="button" onClick={() => {
            void saveDecision(confirmModal.scoreId, confirmModal.evaluationState, confirmModal.score);
            setConfirmModal(null);
          }} disabled={Boolean(busy)}>Confirmar</button>
        </div>
      </div>}
    </dialog>
    <dialog ref={submitConfirmDialogRef} className="pending-dialog confirm-dialog" aria-modal="true" aria-labelledby="submit-confirm-title" onCancel={(event) => { event.preventDefault(); setSubmitConfirm(false); }}>
      <div className="pending-dialog-content">
        <p className="eyebrow">Confirmar planilla</p>
        <h2 id="submit-confirm-title">Cierre definitivo</h2>
        <p>Estás por cerrar la evaluación de <strong>{groups[0]?.troupeName ?? ballot.nightName}</strong>.</p>
        <p className="confirm-score-display">Total: <strong>{scoreTotal} puntos</strong></p>
        <p className="sync-warning">Una vez confirmada, esta planilla no podrá modificarse.</p>
        <div className="pending-dialog-actions modal-actions"><button type="button" className="secondary" onClick={() => setSubmitConfirm(false)} disabled={Boolean(busy)}>Cancelar</button><button type="button" onClick={() => { setSubmitConfirm(false); void submit(); }} disabled={Boolean(busy)}>Confirmar y cerrar</button></div>
      </div>
    </dialog>
  </main>;
}
