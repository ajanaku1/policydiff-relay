import assert from "node:assert/strict";
import { test } from "node:test";

import {
  selectIncidentDelta,
  summarizeReplay,
} from "../../src/api/controlRoomSelection.ts";

test("selects the active incident that has replay findings", () => {
  const deltas = [
    { id: "delta-empty", new_version_id: "version-empty" },
    { id: "delta-ready", new_version_id: "version-ready" },
  ];
  const findings = [
    { id: "finding-ready", new_version_id: "version-ready" },
  ];

  assert.equal(
    selectIncidentDelta(deltas, findings, "version-ready").id,
    "delta-ready",
  );
});

test("falls back to the newest incident with findings", () => {
  const deltas = [
    { id: "delta-empty", new_version_id: "version-empty" },
    { id: "delta-ready", new_version_id: "version-ready" },
  ];
  const findings = [
    { id: "finding-ready", new_version_id: "version-ready" },
  ];

  assert.equal(
    selectIncidentDelta(deltas, findings, "version-empty").id,
    "delta-ready",
  );
});

test("uses trusted finding count when a completed replay has stale counters", () => {
  assert.deepEqual(
    summarizeReplay(
      {
        candidate_count: 0,
        completed_count: 0,
        id: "replay-1",
        status: "completed",
      },
      3,
    ),
    {
      candidateCount: 3,
      completedCount: 3,
      id: "replay-1",
      status: "completed",
    },
  );
});
