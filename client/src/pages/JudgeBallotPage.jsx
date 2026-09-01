import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { apiRequest } from "../api/http.js";
import {
  cacheBallot,
  clearBallotOperations,
  enqueueOperation,
  getBallotOperations,
  getCachedBallot,
  isOperationExpired,
  removeOperations,
} from "../offline/ballot-store.js";

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

function operationId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
    .replace(/(.{8})(.{4})(.{4})(.{4})/, "$1-$2-$3-$4-");
}

export function JudgeBallotPage({ ballotId, troupeId, userId }) {
  const [ballot, setBallot] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [remoteRevision, setRemoteRevision] = useState(0);
  const [syncStatus, setSyncStatus] = useState("idle");
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [expiredPending, setExpiredPending] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pendingDialog, setPendingDialog] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const pendingDialogRef = useRef(null);
  const confirmDialogRef = useRef(null);
  const submitConfirmDialogRef = useRef(null);
  const submitButtonRef = useRef(null);
  const scoreRefs = useRef(new Map());
  const troupeRefs = useRef(new Map());
  const syncInFlightRef = useRef(false);
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

  const offlineUserId = userId || "local-judge";

  const refreshPending = async () => {
    const operations = await getBallotOperations(offlineUserId, ballotId);
    if (!mountedRef.current) return operations;
    setPendingCount(operations.length);
    setPendingSubmit(operations.some((operation) => operation.type === "SUBMIT_BALLOT"));
    setExpiredPending(operations.some(isOperationExpired));
    return operations;
  };

  const loadBallot = async () => {
    if (!ballotId) return;
    try {
      const loaded = await apiRequest(`/api/v1/judge/ballots/${ballotId}`);
      if (!mountedRef.current) return;
      setBallot(loaded);
      setRemoteRevision(loaded.revision ?? 0);
      await cacheBallot(offlineUserId, loaded);
      const pending = await refreshPending();
      if (!mountedRef.current) return;
      setSyncStatus("idle");
      if (pending.length > 0 && navigator.onLine) void syncPending();
    } catch (error) {
      if (error.code === "NETWORK_ERROR") {
        const cached = await getCachedBallot(offlineUserId, ballotId);
        if (cached) {
          if (!mountedRef.current) return;
          setBallot(cached);
          const operations = await refreshPending();
          setRemoteRevision(operations[0]?.baseRevision ?? cached.revision ?? 0);
          setSyncStatus("offline");
          setMessage("Sin conexión: se muestra la última copia disponible en este dispositivo.");
          return;
        }
      }
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

  const syncPending = async () => {
    if (!mountedRef.current || !ballotId || syncStatus === "conflict" || syncStatus === "blocked" || syncInFlightRef.current) return;
    const operations = await refreshPending();
    if (!mountedRef.current) return;
    if (operations.length === 0) return;
    if (!navigator.onLine) {
      setSyncStatus("offline");
      return;
    }
    syncInFlightRef.current = true;
    let resync = false;
    setSyncStatus("syncing");
    try {
      const result = await apiRequest(`/api/v1/judge/ballots/${ballotId}/sync`, {
        method: "POST",
        body: JSON.stringify({
          baseRevision: operations[0].baseRevision,
          operations: operations.map(({ operationId: id, type, scoreId, evaluationState, score }) => ({
            operationId: id,
            type,
            ...(scoreId ? { scoreId, evaluationState, ...(score === undefined ? {} : { score }) } : {}),
          })),
        }),
      });
      await removeOperations(offlineUserId, operations.map((operation) => operation.operationId));
      if (!mountedRef.current) return;
      setRemoteRevision(result.revision);
      setBallot((current) => {
        if (!current) return current;
        const next = {
          ...current,
          revision: result.revision,
          status: operations.some((operation) => operation.type === "SUBMIT_BALLOT") ? "SUBMITTED" : current.status,
          scores: operations.some((operation) => operation.type === "SUBMIT_BALLOT")
            ? current.scores.map((score) => ({ ...score, status: "LOCKED" }))
            : current.scores,
        };
        void cacheBallot(offlineUserId, next);
        return next;
      });
      const remaining = await refreshPending();
      if (!mountedRef.current) return;
      resync = remaining.length > 0;
      setSyncStatus("idle");
      setMessage(operations.some((operation) => operation.type === "SUBMIT_BALLOT")
        ? "Planilla confirmada. Sus puntuaciones quedaron resguardadas."
        : "Cambios sincronizados.");
    } catch (error) {
      if (!mountedRef.current) return;
      if (error.code === "NETWORK_ERROR") {
        setSyncStatus("offline");
        setMessage("Cambios guardados en este dispositivo. Se sincronizarán al recuperar conexión.");
        return;
      }
      if (error.code === "BALLOT_REVISION_CONFLICT") {
        setSyncStatus("conflict");
        setMessage("La planilla cambió en otro dispositivo. Recargá el estado antes de continuar.");
        return;
      }
      if (error.code === "BALLOT_INCOMPLETE") {
        const submitOperations = operations.filter((operation) => operation.type === "SUBMIT_BALLOT");
        await removeOperations(offlineUserId, submitOperations.map((operation) => operation.operationId));
        await refreshPending();
        setPendingDialog(getPendingItems(ballot?.scores ?? [], error.details));
        setSyncStatus("idle");
        return;
      }
      setSyncStatus("blocked");
      setMessage("La sincronización fue rechazada. Revisá la planilla o descartá los cambios locales.");
    } finally {
      syncInFlightRef.current = false;
      if (resync && mountedRef.current) void syncPending();
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      void syncPending();
    };
    const handleOffline = () => {
      setOnline(false);
      setSyncStatus("offline");
    };
    const handleFocus = () => {
      if (navigator.onLine) void syncPending();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
    };
  }, [ballotId, remoteRevision, syncStatus]);

  const saveDecision = async (scoreId, evaluationState, score) => {
    if (!ballot || busy || pendingSubmit) return;
    setBusy(scoreId);
    setMessage("");
    try {
      const next = {
        ...ballot,
        revision: (ballot.revision ?? remoteRevision) + 1,
        scores: ballot.scores.map((item) => item.id === scoreId
          ? { ...item, evaluationState, score: evaluationState === "PENDING" ? null : evaluationState === "NOT_PRESENTED" ? 0 : score }
          : item),
      };
      await enqueueOperation(offlineUserId, {
        operationId: operationId(),
        ballotId: ballot.id,
        baseRevision: remoteRevision,
        type: "SAVE_SCORE",
        scoreId,
        evaluationState,
        ...(score === undefined ? {} : { score }),
      });
      setBallot(next);
      await cacheBallot(offlineUserId, next);
      await refreshPending();
      setMessage("Decisión pendiente de sincronización.");
      void syncPending();
    } catch (error) {
      setMessage("No se pudo guardar la decisión en este dispositivo.");
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
      await enqueueOperation(offlineUserId, {
        operationId: operationId(),
        ballotId: ballot.id,
        baseRevision: remoteRevision,
        type: "SUBMIT_BALLOT",
      });
      await refreshPending();
      setMessage("Confirmación pendiente de sincronización.");
      void syncPending();
    } catch (error) {
      if (error.code === "BALLOT_INCOMPLETE") {
        setPendingDialog(getPendingItems(ballot.scores, error.details));
      } else {
        setMessage("No se pudo confirmar la planilla.");
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

  const readonly = ballot.status === "SUBMITTED" || pendingSubmit;
  const groups = Object.values(groupScores(ballot.scores)).sort((left, right) => left.presentationOrder - right.presentationOrder);
  const resolved = ballot.scores.filter((score) => score.evaluationState !== "PENDING").length;
  const total = ballot.scores.length;
  const progress = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const scoreTotal = ballot.scores.reduce((sum, score) => sum + (typeof score.score === "number" ? score.score : 0), 0);

  return <main className="judge-ballot-page judge-operation-shell">
    <header className="ballot-header">
      <div><a className="back-link" href="#/judge">← Comparsas</a><p className="eyebrow">Planilla de jurado</p><h1>{ballot.nightName}</h1><p>{ballot.specialtyName} · {groups.length} comparsa{groups.length === 1 ? "" : "s"}</p></div>
      <div className="ballot-header-status"><span className={`status-pill ballot-status-${ballot.status.toLowerCase()}`}>{ballot.status === "SUBMITTED" ? "✓ Confirmada" : ballot.status === "REOPENED" ? "Reabierta" : "En carga"}</span><span className={`connection-badge ${online ? "is-online" : "is-offline"}`}><span aria-hidden="true">{online ? "●" : "!"}</span> {online ? "Online" : "Offline"}</span></div>
    </header>
    <section className="ballot-progress" aria-label="Progreso de la planilla"><div><span>Progreso</span><strong>{resolved} / {total}</strong></div><div className="progress-track"><span style={{ inlineSize: `${progress}%` }} /></div><p>{progress}% completado · {ballot.specialtyName}</p></section>
    <p className="feedback" role="status" aria-live="polite">{message}</p>
    <section className="sync-panel" aria-label="Estado de sincronización">
      <strong>{syncStatus === "syncing" ? "↻ Sincronizando" : online ? "✓ Guardado en este dispositivo" : "● Sin conexión"}</strong>
      <span>{pendingCount === 0 ? "Sin cambios pendientes" : `${pendingCount} cambio${pendingCount === 1 ? "" : "s"} pendiente${pendingCount === 1 ? "" : "s"}`}</span>
      {expiredPending && <span className="sync-warning">Hay cambios pendientes hace más de 12 horas.</span>}
      {syncStatus === "conflict" && <button type="button" className="secondary" onClick={() => void loadBallot()}>Recargar estado canónico</button>}
      {pendingCount > 0 && syncStatus !== "blocked" && <button type="button" className="secondary" disabled={syncStatus === "syncing"} onClick={() => void syncPending()}>Reintentar sincronización</button>}
      {(syncStatus === "conflict" || syncStatus === "blocked") && <button type="button" className="secondary" onClick={() => void clearBallotOperations(offlineUserId, ballot.id).then(() => { void refreshPending(); setSyncStatus("idle"); setMessage("Cambios locales descartados."); })}>Descartar cambios locales</button>}
    </section>
    <div className="ballot-workspace">
      <aside className="ballot-sidebar" aria-label="Navegación de comparsas">
        <p className="eyebrow">Comparsas</p>
        <ol>{groups.map((group) => {
          const troupeResolved = Object.values(group.rubrics).flatMap((rubric) => rubric.scores).filter((score) => score.evaluationState !== "PENDING").length;
          const troupeTotal = Object.values(group.rubrics).flatMap((rubric) => rubric.scores).length;
          return <li key={group.nightScheduleId}><button type="button" onClick={() => goToTroupe(group.nightScheduleId)}><span>{group.troupeName}</span><small>{troupeResolved} / {troupeTotal} resueltos</small></button></li>;
        })}</ol>
      </aside>
      <section className="ballot-list" aria-label="Puntuaciones por comparsa">
        {groups.map((group) => <article className="ballot-troupe" key={group.nightScheduleId} ref={(element) => { if (element) troupeRefs.current.set(group.nightScheduleId, element); else troupeRefs.current.delete(group.nightScheduleId); }}>
          <header><p className="eyebrow">Salida {group.presentationOrder}</p><h2>{group.troupeName}</h2></header>
          {Object.values(group.rubrics).map((rubric) => <section className="ballot-rubric" key={rubric.rubricId}>
            <h3>{rubric.rubricName}</h3>
            {rubric.scores.map((score) => <div className={`score-row score-state-${score.evaluationState.toLowerCase()}`} key={score.id} ref={(element) => { if (element) scoreRefs.current.set(score.id, element); else scoreRefs.current.delete(score.id); }}>
              <div className="score-copy"><span>{score.itemName}</span><small>{score.evaluationState === "NOT_PRESENTED" ? "No se presentó" : score.evaluationState === "SCORED" ? "Decisión confirmada" : "Pendiente de decisión"}</small></div>
              {score.evaluationState !== "PENDING" ? <div className={`locked-score ${score.evaluationState === "NOT_PRESENTED" ? "not-presented" : ""}`} aria-label={`${group.troupeName}: ${score.itemName}, ${score.evaluationState === "NOT_PRESENTED" ? "No se presentó" : `puntuado ${score.score}`}`}><span aria-hidden="true">{score.evaluationState === "NOT_PRESENTED" ? "⊘" : "✓"}</span><strong>{score.evaluationState === "NOT_PRESENTED" ? "No se presentó" : score.score}</strong><small>Decisión bloqueada</small></div> : <div className="score-actions" role="group" aria-label={`${group.troupeName}: ${score.itemName}`}>
                <p>Seleccioná una puntuación</p>
                <div className="score-grid">{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => <button key={value} type="button" disabled={readonly || score.status === "LOCKED" || Boolean(busy)} onClick={() => setConfirmModal({ scoreId: score.id, evaluationState: "SCORED", score: value, itemContext: { troupeName: group.troupeName, rubricName: rubric.rubricName, itemName: score.itemName } })}>{value}</button>)}</div>
                <button type="button" className="not-presented-action" disabled={readonly || score.status === "LOCKED" || Boolean(busy)} onClick={() => setConfirmModal({ scoreId: score.id, evaluationState: "NOT_PRESENTED", score: 0, itemContext: { troupeName: group.troupeName, rubricName: rubric.rubricName, itemName: score.itemName } })}>No se presentó</button>
              </div>}
            </div>)}
          </section>)}
        </article>)}
      </section>
    </div>
    <footer className="ballot-footer">
      <a className="secondary button-link" href="#/judge">Volver al panel</a>
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
