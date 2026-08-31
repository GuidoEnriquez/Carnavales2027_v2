import { afterEach, describe, expect, it } from "vitest";
import {
  cacheBallot,
  clearUserOfflineData,
  enqueueOperation,
  getBallotOperations,
  getCachedBallot,
} from "../offline/ballot-store.js";

describe("ballot-store", () => {
  const userId = "judge-offline-test";

  afterEach(async () => {
    await clearUserOfflineData(userId);
    await clearUserOfflineData("other-judge-offline-test");
  });

  it("aísla la cache y conserva la outbox en orden FIFO", async () => {
    await cacheBallot(userId, { id: "ballot-1", revision: 3, scores: [] });
    await enqueueOperation(userId, {
      operationId: "operation-1",
      ballotId: "ballot-1",
      baseRevision: 3,
      type: "SAVE_SCORE",
      scoreId: "score-1",
      evaluationState: "SCORED",
      score: 8,
    });
    await enqueueOperation(userId, {
      operationId: "operation-2",
      ballotId: "ballot-1",
      baseRevision: 4,
      type: "SUBMIT_BALLOT",
    });

    expect(await getCachedBallot(userId, "ballot-1")).toMatchObject({ revision: 3 });
    expect(await getCachedBallot("other-judge-offline-test", "ballot-1")).toBeNull();
    expect((await getBallotOperations(userId, "ballot-1")).map((operation) => operation.operationId))
      .toEqual(["operation-1", "operation-2"]);
  });
});
