import { useEffect, useRef, useState } from "react";
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

export function JudgeBallotPage({ ballotId }) {
  const [ballot, setBallot] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [pendingDialog, setPendingDialog] = useState(null);
  const pendingDialogRef = useRef(null);
  const submitButtonRef = useRef(null);

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

  const loadBallot = async () => {
    if (!ballotId) return;
    try {
      setBallot(await apiRequest(`/api/v1/judge/ballots/${ballotId}`));
    } catch (error) {
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

  const saveDecision = async (scoreId, evaluationState, score) => {
    if (!ballot || busy) return;
    setBusy(scoreId);
    setMessage("");
    try {
      const saved = await apiRequest(`/api/v1/judge/ballots/${ballot.id}/scores/${scoreId}`, {
        method: "PUT",
        body: JSON.stringify({ evaluationState, ...(score === undefined ? {} : { score }) }),
      });
      setBallot((current) => ({
        ...current,
        scores: current.scores.map((score) => score.id === saved.id ? { ...score, ...saved } : score),
      }));
      setMessage("Decisión guardada.");
    } catch (error) {
      const messages = {
        BALLOT_ALREADY_SUBMITTED: "La planilla ya fue confirmada.",
        BALLOT_SCORE_IMMUTABLE: "Esta puntuación ya no admite cambios.",
      };
      setMessage(messages[error.code] ?? "No se pudo guardar la puntuación.");
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
      const submitted = await apiRequest(`/api/v1/judge/ballots/${ballot.id}/submit`, { method: "POST" });
      setBallot((current) => ({
        ...current,
        ...submitted,
        scores: current.scores.map((score) => ({ ...score, status: "LOCKED" })),
      }));
      setMessage("Planilla confirmada. Sus puntuaciones quedaron resguardadas.");
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

  const readonly = ballot.status === "SUBMITTED";
  const groups = Object.values(groupScores(ballot.scores)).sort((left, right) => left.presentationOrder - right.presentationOrder);

  return <main className="judge-ballot-page">
    <header className="ballot-header">
      <div><p className="eyebrow">Planilla de jurado</p><h1>{ballot.nightName}</h1><p>{ballot.eventName} · {ballot.specialtyName}</p></div>
      <span className={`status-pill ballot-status-${ballot.status.toLowerCase()}`}>{ballot.status === "SUBMITTED" ? "Confirmada" : ballot.status === "REOPENED" ? "Reabierta" : "En carga"}</span>
    </header>
    <p className="feedback" role="status" aria-live="polite">{message}</p>
    <section className="ballot-list" aria-label="Puntuaciones por comparsa">
      {groups.map((group) => <article className="ballot-troupe" key={group.nightScheduleId}>
        <header><p className="eyebrow">Salida {group.presentationOrder}</p><h2>{group.troupeName}</h2></header>
        {Object.values(group.rubrics).map((rubric) => <section className="ballot-rubric" key={rubric.rubricId}>
          <h3>{rubric.rubricName}</h3>
          {rubric.scores.map((score) => <div className="score-row" key={score.id}>
            <div><span>{score.itemName}</span><small>{score.evaluationState === "NOT_PRESENTED" ? "No se presentó" : score.evaluationState === "SCORED" ? `Puntuado: ${score.score}` : "Pendiente"}</small></div>
            <div className="score-actions" role="group" aria-label={`${group.troupeName}: ${score.itemName}`}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => <button key={value} type="button" className={score.evaluationState === "SCORED" && score.score === value ? "is-selected" : ""} disabled={readonly || score.status === "LOCKED" || Boolean(busy)} onClick={() => void saveDecision(score.id, "SCORED", value)}>{value}</button>)}
              <button type="button" className={score.evaluationState === "NOT_PRESENTED" ? "is-selected" : ""} disabled={readonly || score.status === "LOCKED" || Boolean(busy)} onClick={() => void saveDecision(score.id, "NOT_PRESENTED")}>No se presentó</button>
              {score.evaluationState !== "PENDING" && <button type="button" className="score-clear" disabled={readonly || score.status === "LOCKED" || Boolean(busy)} onClick={() => void saveDecision(score.id, "PENDING")}>Quitar decisión</button>}
            </div>
          </div>)}
        </section>)}
      </article>)}
    </section>
    <footer className="ballot-footer">
      <a className="secondary button-link" href="#/judge">Volver al panel</a>
      {!readonly && <button ref={submitButtonRef} type="button" disabled={Boolean(busy)} onClick={() => void submit()}>{busy === "submit" ? "Confirmando…" : "Confirmar planilla"}</button>}
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
          {pendingDialog.map((item) => <li key={item.id}>
            <span>{item.troupeName}</span>
            <span>{item.rubricName}</span>
            <strong>{item.itemName}</strong>
          </li>)}
        </ul>
        <div className="pending-dialog-actions"><button data-pending-dialog-close type="button" onClick={closePendingDialog}>Volver a la planilla</button></div>
      </div>}
    </dialog>
  </main>;
}
