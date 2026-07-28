import {
  createClientFromRequest,
  type Base44Client,
  type EntityRecord,
} from "@base44/sdk";

import {
  type AgentFindingReader,
  type AgentFindingView,
  explainFinding,
} from "../../shared/agent-tools.ts";
import {
  buildWorkflowActor,
  readJsonObject,
  readRequiredString,
  serveBase44Function,
} from "../../shared/base44-http.ts";

class Base44FindingReader implements AgentFindingReader {
  constructor(private readonly base44: Base44Client) {}

  async load(findingId: string): Promise<AgentFindingView> {
    const finding = await this.base44.entities.Finding.get(findingId);
    const clauses = await Promise.all(
      finding.evidence_clause_ids.map((id) =>
        this.base44.entities.PolicyClause.get(id)
      ),
    );
    return toAgentFindingView(finding, clauses);
  }
}

function toAgentFindingView(
  finding: EntityRecord["Finding"],
  clauses: EntityRecord["PolicyClause"][],
): AgentFindingView {
  return {
    classification: finding.classification,
    evidence: clauses.map((clause) => ({
      clauseId: clause.id,
      excerpt: clause.body,
    })),
    findingId: finding.id,
    organizationId: finding.organization_id,
    rationale: finding.rationale ?? "No model rationale was retained.",
    status: finding.status,
  };
}

serveBase44Function(async (request) => {
  const base44 = createClientFromRequest(request);
  const actor = buildWorkflowActor(await base44.auth.me());
  const body = await readJsonObject(request);
  const result = await explainFinding(
    { actor, findingId: readRequiredString(body, "finding_id") },
    new Base44FindingReader(base44),
  );
  return Response.json(result);
});
