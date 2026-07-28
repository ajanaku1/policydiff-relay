import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compareClauseSets,
  selectReplayCandidates,
  validateClauseCandidates,
  validateReplayCandidate,
} from "../../base44/shared/policy-analysis.ts";

const oldClauses = [
  {
    body: "Employees aged 18 or older are eligible after 30 days.",
    bodyHash: "old-eligibility-hash",
    clauseKey: "eligibility.age",
    heading: "Eligibility",
    id: "old-clause-eligibility",
    versionId: "version-old",
  },
  {
    body: "Employees receive 15 days of paid leave.",
    bodyHash: "leave-hash",
    clauseKey: "leave.annual",
    heading: "Annual leave",
    id: "old-clause-leave",
    versionId: "version-old",
  },
];

const newClauses = [
  {
    body: "Employees aged 21 or older are eligible after 30 days.",
    bodyHash: "new-eligibility-hash",
    clauseKey: "eligibility.age",
    heading: "Eligibility",
    id: "new-clause-eligibility",
    versionId: "version-new",
  },
  {
    body: "Employees receive 15 days of paid leave.",
    bodyHash: "leave-hash",
    clauseKey: "leave.annual",
    heading: "Annual leave",
    id: "new-clause-leave",
    versionId: "version-new",
  },
];

describe("policy analysis contracts", () => {
  it("accepts structured clauses and rejects duplicate clause keys", () => {
    const valid = validateClauseCandidates({
      clauses: [
        {
          body: "Employees aged 21 or older are eligible.",
          clause_key: "eligibility.age",
          heading: "Eligibility",
        },
      ],
    });
    assert.equal(valid[0]?.clauseKey, "eligibility.age");

    assert.throws(
      () =>
        validateClauseCandidates({
          clauses: [
            { body: "First", clause_key: "duplicate", heading: "One" },
            { body: "Second", clause_key: "duplicate", heading: "Two" },
          ],
        }),
      { code: "CLAUSE_OUTPUT_INVALID" },
    );
  });

  it("uses numbered headings as stable clause keys", () => {
    const clauses = validateClauseCandidates({
      clauses: [
        {
          body: "Applicants must be at least 21 years old.",
          clause_key: "sec_4_2_eligibility_age",
          heading: "§4.2 Eligibility age",
        },
      ],
    });

    assert.equal(clauses[0]?.clauseKey, "4.2");
  });

  it("finds one material delta for the changed eligibility clause", () => {
    const delta = compareClauseSets(
      "version-old",
      "version-new",
      oldClauses,
      newClauses,
    );

    assert.deepEqual(delta, {
      changedClauses: [
        {
          clauseKey: "eligibility.age",
          newClauseId: "new-clause-eligibility",
          oldClauseId: "old-clause-eligibility",
          type: "modified",
        },
      ],
      materiality: "material",
      newVersionId: "version-new",
      oldVersionId: "version-old",
    });
  });

  it("replays only guidance passing version, audience, date, and clause filters", () => {
    const guidance = [
      {
        audience: "employees",
        citedClauseIds: ["old-clause-eligibility"],
        effectiveOn: "2026-07-01",
        id: "guidance-affected",
        policyVersionId: "version-old",
      },
      {
        audience: "contractors",
        citedClauseIds: ["old-clause-eligibility"],
        effectiveOn: "2026-06-10",
        id: "guidance-uncertain",
        policyVersionId: "version-old",
      },
      {
        audience: "employees",
        citedClauseIds: ["old-clause-leave"],
        effectiveOn: "2026-07-01",
        id: "guidance-unrelated",
        policyVersionId: "version-old",
      },
    ];

    const selected = selectReplayCandidates(guidance, {
      allowedAudiences: ["employees", "contractors"],
      changedOldClauseIds: ["old-clause-eligibility"],
      effectiveThrough: "2026-07-27",
      oldVersionId: "version-old",
    });

    assert.deepEqual(
      selected.map((candidate) => candidate.guidance.id),
      ["guidance-affected", "guidance-uncertain"],
    );
  });

  it("binds replay output to supplied versions and evidence", () => {
    const context = {
      allowedEvidenceClauseIds: [
        "old-clause-eligibility",
        "new-clause-eligibility",
      ],
      newVersionId: "version-new",
      oldVersionId: "version-old",
    };
    const candidate = validateReplayCandidate(
      {
        classification: "affected",
        evidence_clause_ids: [
          "old-clause-eligibility",
          "new-clause-eligibility",
        ],
        new_version_id: "version-new",
        old_version_id: "version-old",
        rationale: "The minimum age changed from 18 to 21.",
      },
      context,
    );
    assert.equal(candidate.classification, "affected");

    assert.throws(
      () =>
        validateReplayCandidate(
          {
            classification: "affected",
            evidence_clause_ids: ["invented-clause"],
            new_version_id: "version-new",
            old_version_id: "version-old",
            rationale: "Unsupported evidence.",
          },
          context,
        ),
      { code: "REPLAY_OUTPUT_INVALID" },
    );
  });
});
