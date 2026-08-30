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

  const saveScore = async (scoreId, value) => {
    if (!ballot || busy) return;
    setBusy(scoreId);
    setMessage("");
    try {
      const saved = await apiRequest(`/api/v1/judge/ballots/${ballot.id}/scores/${scoreId}`, {
        method: "PUT",
        body: JSON.stringify({ score: value === "" ? null : Number(value) }),
      });
      setBallot((current) => ({
        ...current,
        scores: current.scores.map((score) => score.id === saved.id ? { ...score, ...saved } : score),
      }));
      setMessage("Puntuación guardada.");
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
          {rubric.scores.map((score) => <label className="score-row" key={score.id}>
            <span>{score.itemName}</span>
            <select value={score.score ?? ""} disabled={readonly || score.status === "LOCKED" || Boolean(busy)} onChange={(event) => void saveScore(score.id, event.target.value)} aria-label={`${group.troupeName}: ${score.itemName}`}>
              <option value="">Pendiente</option>
              <option value="0">0 · No presentado</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>)}
        </section>)}
      </article>)}
    </section>
    <footer className="ballot-footer">
      <a className="secondary button-link" href="#/judge">Volver al panel</a>
      {!readonly && <button type="button" disabled={Boolean(busy)} onClick={() => void submit()}>{busy === "submit" ? "Confirmando…" : "Confirmar planilla"}</button>}
    </footer>
  </main>;
}
