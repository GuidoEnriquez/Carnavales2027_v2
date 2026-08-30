import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { closePool } from "../pool.js";
import { getMigrationStatus, migrate } from "../migrate.js";

const originalDatabaseUrl = process.env.DATABASE_URL;

function restoreDatabaseUrl() {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
    return;
  }

  process.env.DATABASE_URL = originalDatabaseUrl;
}

afterEach(async () => {
  await closePool();
  restoreDatabaseUrl();
});

test("aplica migraciones pendientes una vez y conserva su estado", {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

  const firstRun = await migrate();
  assert.ok(firstRun.applied.every((filename) => (
    filename === "001_extensions.sql"
    || filename === "002_authorization.sql"
    || filename === "003_audit.sql"
    || filename === "004_bootstrap.sql"
    || filename === "005_last_admin_guard.sql"
    || filename === "006_last_admin_update_guard.sql"
    || filename === "007_events.sql"
    || filename === "008_categories.sql"
    || filename === "009_troupes.sql"
    || filename === "010_specialties.sql"
    || filename === "011_rubrics.sql"
    || filename === "012_nominations.sql"
    || filename === "013_night_schedule.sql"
    || filename === "014_event_configuration_guard.sql"
    || filename === "015_configuration_seed.sql"
    || filename === "016_forbid_event_reassignment.sql"
    || filename === "017_complete_event_immutability.sql"
    || filename === "018_require_audited_event_open.sql"
    || filename === "019_configuration_closure.sql"
    || filename === "020_allow_unchanged_inactive_references.sql"
    || filename === "021_guard_inactive_reference_reactivation.sql"
    || filename === "022_judge_roster.sql"
    || filename === "023_judge_invitations.sql"
    || filename === "024_judge_history_guards.sql"
    || filename === "025_judge_transition_guards.sql"
    || filename === "026_invitation_delivery_after_acceptance.sql"
    || filename === "027_invitation_acceptance_claim.sql"
    || filename === "028_judge_quotas_assignments.sql"
    || filename === "029_night_operational_status.sql"
    || filename === "030_harden_judge_quota_guard.sql"
    || filename === "031_add_unique_constraints.sql"
    || filename === "032_ballots.sql"
    || filename === "033_ballot_scores.sql"
    || filename === "034_ballot_audit.sql"
     || filename === "035_ballot_triggers.sql"
     || filename === "036_ballot_score_triggers.sql"
     || filename === "037_allow_reopened_ballot_scores.sql"
     || filename === "038_ballot_score_per_schedule.sql"
      || filename === "039_add_veedor_role.sql"
      || filename === "040_enforce_ballot_deletion_guards.sql"
      || filename === "041_ballot_score_subsanations.sql"
      || filename === "042_harden_ballot_score_subsanation_guard.sql"
      || filename === "043_harden_ballot_integrity.sql"
      || filename === "044_voting_windows.sql"
      || filename === "045_enforce_ballot_score_rubric_integrity.sql"
  )));

  const status = await getMigrationStatus();
  assert.deepEqual(status, [
    {
      filename: "001_extensions.sql",
      version: "001",
      applied: true,
    },
    {
      filename: "002_authorization.sql",
      version: "002",
      applied: true,
    },
    {
      filename: "003_audit.sql",
      version: "003",
      applied: true,
    },
    {
      filename: "004_bootstrap.sql",
      version: "004",
      applied: true,
    },
    {
      filename: "005_last_admin_guard.sql",
      version: "005",
      applied: true,
    },
    {
      filename: "006_last_admin_update_guard.sql",
      version: "006",
      applied: true,
    },
    {
      filename: "007_events.sql",
      version: "007",
      applied: true,
    },
    {
      filename: "008_categories.sql",
      version: "008",
      applied: true,
    },
    {
      filename: "009_troupes.sql",
      version: "009",
      applied: true,
    },
    {
      filename: "010_specialties.sql",
      version: "010",
      applied: true,
    },
    {
      filename: "011_rubrics.sql",
      version: "011",
      applied: true,
    },
    {
      filename: "012_nominations.sql",
      version: "012",
      applied: true,
    },
    {
      filename: "013_night_schedule.sql",
      version: "013",
      applied: true,
    },
    {
      filename: "014_event_configuration_guard.sql",
      version: "014",
      applied: true,
    },
    {
      filename: "015_configuration_seed.sql",
      version: "015",
      applied: true,
    },
    {
      filename: "016_forbid_event_reassignment.sql",
      version: "016",
      applied: true,
    },
    {
      filename: "017_complete_event_immutability.sql",
      version: "017",
      applied: true,
    },
    {
      filename: "018_require_audited_event_open.sql",
      version: "018",
      applied: true,
    },
    {
      filename: "019_configuration_closure.sql",
      version: "019",
      applied: true,
    },
    {
      filename: "020_allow_unchanged_inactive_references.sql",
      version: "020",
      applied: true,
    },
    {
      filename: "021_guard_inactive_reference_reactivation.sql",
      version: "021",
      applied: true,
    },
    {
      filename: "022_judge_roster.sql",
      version: "022",
      applied: true,
    },
    {
      filename: "023_judge_invitations.sql",
      version: "023",
      applied: true,
    },
    {
      filename: "024_judge_history_guards.sql",
      version: "024",
      applied: true,
    },
    {
      filename: "025_judge_transition_guards.sql",
      version: "025",
      applied: true,
    },
    {
      filename: "026_invitation_delivery_after_acceptance.sql",
      version: "026",
      applied: true,
    },
    {
      filename: "027_invitation_acceptance_claim.sql",
      version: "027",
      applied: true,
    },
    {
      filename: "028_judge_quotas_assignments.sql",
      version: "028",
      applied: true,
    },
    {
      filename: "029_night_operational_status.sql",
      version: "029",
      applied: true,
    },
    {
      filename: "030_harden_judge_quota_guard.sql",
      version: "030",
      applied: true,
    },
    {
      filename: "031_add_unique_constraints.sql",
      version: "031",
      applied: true,
    },
    {
      filename: "032_ballots.sql",
      version: "032",
      applied: true,
    },
    {
      filename: "033_ballot_scores.sql",
      version: "033",
      applied: true,
    },
    {
      filename: "034_ballot_audit.sql",
      version: "034",
      applied: true,
    },
    {
      filename: "035_ballot_triggers.sql",
      version: "035",
      applied: true,
    },
    {
      filename: "036_ballot_score_triggers.sql",
      version: "036",
      applied: true,
    },
    {
      filename: "037_allow_reopened_ballot_scores.sql",
      version: "037",
      applied: true,
    },
    {
      filename: "038_ballot_score_per_schedule.sql",
      version: "038",
      applied: true,
    },
    {
      filename: "039_add_veedor_role.sql",
      version: "039",
      applied: true,
    },
    {
      filename: "040_enforce_ballot_deletion_guards.sql",
      version: "040",
      applied: true,
    },
    {
      filename: "041_ballot_score_subsanations.sql",
      version: "041",
      applied: true,
    },
    {
      filename: "042_harden_ballot_score_subsanation_guard.sql",
      version: "042",
      applied: true,
    },
    {
      filename: "043_harden_ballot_integrity.sql",
      version: "043",
      applied: true,
    },
    {
      filename: "044_voting_windows.sql",
      version: "044",
      applied: true,
    },
    {
      filename: "045_enforce_ballot_score_rubric_integrity.sql",
      version: "045",
      applied: true,
    },
  ]);

  const secondRun = await migrate();
  assert.deepEqual(secondRun.applied, []);
});
