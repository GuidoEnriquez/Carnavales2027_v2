export function sendKnownError(response, error) {
  if (error.type === "entity.parse.failed") {
    response.status(400).json({ code: "VALIDATION_ERROR" });
    return true;
  }
  if (error instanceof TypeError) {
    response.status(400).json({ code: "VALIDATION_ERROR", message: error.message });
    return true;
  }
  if (error.message === "RESULTS_NOT_RELEASED" || error.message === "RESULTS_ACCESS_DENIED") {
    response.status(403).json({ code: error.message });
    return true;
  }
  if (error.message === "TIE_BREAKER_REQUIRES_MANUAL_DRAW") {
    response.status(409).json({
      code: error.message,
      remainingTroupeIds: error.remainingTroupeIds ?? [],
      tieBreakerContext: error.tieBreakerContext ?? {},
    });
    return true;
  }
  if (
    [
      "TIE_BREAKER_NOT_REQUIRED",
      "TIE_BREAKER_ALREADY_DRAWN",
      "TIE_BREAKER_STALE",
    ].includes(error.message)
  ) {
    response.status(409).json({
      code: error.message,
      expectedTroupeIds: error.expectedTroupeIds,
      receivedTroupeIds: error.receivedTroupeIds,
    });
    return true;
  }
  if (
    ["TIE_BREAKER_EMPTY_DRAW_POOL", "TIE_BREAKER_INVALID_DRAW_INPUT"].includes(
      error.message,
    )
  ) {
    response.status(422).json({ code: error.message });
    return true;
  }
  if (error.message === "EVENT_LOCKED" || error.message === "LAST_ADMIN_REQUIRED") {
    response.status(409).json({ code: error.message });
    return true;
  }
  if (["CATEGORY_INACTIVE", "SPECIALTY_INACTIVE"].includes(error.message)) {
    response.status(409).json({ code: error.message });
    return true;
  }
  if (["INVALID_JUDGE_STATUS", "ACCOUNT_ALREADY_EXISTS"].includes(error.message)) {
    response.status(409).json({ code: error.message });
    return true;
  }
  if (["JUDGE_PROFILE_REQUIRED", "JUDGE_INACTIVE", "JUDGE_SUSPENDED"].includes(error.message)) {
    response.status(403).json({ code: error.message });
    return true;
  }
  if ([
    "JUDGE_QUOTA_BELOW_ASSIGNMENTS",
    "JUDGE_QUOTA_FULL",
    "JUDGE_QUOTA_REQUIRED",
    "JUDGE_ALREADY_ASSIGNED",
    "JUDGE_NOT_ASSIGNABLE",
    "JUDGE_ASSIGNMENT_FINAL",
    "JUDGE_ASSIGNMENT_OPEN_REQUIRES_REPLACEMENT",
    "JUDGE_ASSIGNMENT_COMPETITION_ONLY",
    "NIGHT_CLOSED",
    "REVOCATION_REASON_REQUIRED",
    "INVALID_REPLACEMENT",
    "INVALID_ASSIGNMENT_REFERENCE",
    "INVALID_NIGHT_STATUS",
    "JUDGE_QUOTA_DELETE_FORBIDDEN",
  ].includes(error.message)) {
    response.status(409).json({ code: error.message });
    return true;
  }
  if (error.message === "BALLOT_INCOMPLETE") {
    response.status(409).json({ code: error.message, details: error.pending ?? [] });
    return true;
  }
  if (error.message === "BALLOT_REVISION_CONFLICT") {
    response.status(409).json({ code: error.message, details: error.details ?? {} });
    return true;
  }
  if (error.message === "VOTING_CLOSE_INCOMPLETE_BALLOTS") {
    response.status(409).json({ code: error.message, details: error.pending ?? [] });
    return true;
  }
  if ([
    "BALLOT_NOT_FOUND",
    "BALLOT_ACCESS_DENIED",
    "BALLOT_ALREADY_SUBMITTED",
    "BALLOT_SCORE_IMMUTABLE",
    "SCORE_IMMUTABLE",
    "SCORE_NOT_FOUND",
    "EVENT_NOT_OPEN",
    "NIGHT_NOT_OPEN",
    "VOTING_COMPETITION_ONLY",
    "VOTING_WINDOW_CLOSED",
    "VOTING_WINDOW_NOT_OPEN",
    "SYNC_OPERATION_MISMATCH",
    "SYNC_BATCH_MIXED_RETRY",
  ].includes(error.message)) {
    response.status(409).json({ code: error.message });
    return true;
  }
  if (error.message === "INVITATION_INVALID") {
    response.status(400).json({ code: "INVITATION_INVALID" });
    return true;
  }
  if (error.message === "INVITATION_DELIVERY_FAILED") {
    response.status(502).json({ code: error.message });
    return true;
  }
  if (error.message === "SESSION_REVOCATION_FAILED") {
    response.status(503).json({ code: error.message });
    return true;
  }
  if (error.message.endsWith("_NOT_FOUND")) {
    response.status(404).json({ code: error.message });
    return true;
  }
  if (error.code === "23505") {
    response.status(409).json({ code: "RESOURCE_CONFLICT" });
    return true;
  }
  if (error.code === "23503") {
    response.status(409).json({ code: "INVALID_REFERENCE" });
    return true;
  }
  if (["22007", "23514", "22P02"].includes(error.code)) {
    response.status(400).json({ code: "VALIDATION_ERROR" });
    return true;
  }
  return false;
}
