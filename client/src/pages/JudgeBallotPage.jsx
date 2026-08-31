import { useEffect, useState } from "react";
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

export function JudgeBallotPage({ ballotId }) {
  const [ballot, setBallot] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

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
    setBusy("submit");
    setMessage("");
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
        const pending = error.details?.map((item) => item.name).join(", ");
        setMessage(`Faltan puntuaciones por resolver${pending ? `: ${pending}.` : "."}`);
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
      {!readonly && <button type="button" disabled={Boolean(busy)} onClick={() => void submit()}>{busy === "submit" ? "Confirmando…" : "Confirmar planilla"}</button>}
    </footer>
  </main>;
}
