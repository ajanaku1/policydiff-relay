import {
  createClientFromRequest,
  type Base44Client,
  type EntityRecord,
} from "@base44/sdk";

import {
  type ReviewerTaskRecord,
  type ReviewerTaskRepository,
  createReviewerTask,
} from "../../shared/agent-tools.ts";
import {
  buildWorkflowActor,
  readJsonObject,
  readRequiredString,
  serveBase44Function,
} from "../../shared/base44-http.ts";

class Base44ReviewerTasks implements ReviewerTaskRepository {
  constructor(private readonly base44: Base44Client) {}

  async createOrGet(input: {
    createdByUserId: string;
    findingId: string;
    note: string;
    organizationId: string;
  }): Promise<ReviewerTaskRecord> {
    const dedupeKey = `${input.findingId}:${input.createdByUserId}`;
    const existing = await this.findByDedupeKey(dedupeKey);
    const task = existing ?? await this.createOrReadWinner(input, dedupeKey);
    return toReviewerTaskRecord(task);
  }

  private async createOrReadWinner(
    input: {
      createdByUserId: string;
      findingId: string;
      note: string;
      organizationId: string;
    },
    dedupeKey: string,
  ): Promise<EntityRecord["ReviewTask"]> {
    try {
      return await this.create(input, dedupeKey);
    } catch (error) {
      const winner = await this.findByDedupeKey(dedupeKey);
      if (!winner) {
        throw error;
      }
      return winner;
    }
  }

  private async findByDedupeKey(
    dedupeKey: string,
  ): Promise<EntityRecord["ReviewTask"] | undefined> {
    const [task] = await this.base44.asServiceRole.entities.ReviewTask.filter(
      { dedupe_key: dedupeKey },
      "-created_date",
      1,
    );
    return task;
  }

  private create(
    input: {
      createdByUserId: string;
      findingId: string;
      note: string;
      organizationId: string;
    },
    dedupeKey: string,
  ): Promise<EntityRecord["ReviewTask"]> {
    return this.base44.asServiceRole.entities.ReviewTask.create({
      created_by_kind: "agent",
      created_by_user_id: input.createdByUserId,
      dedupe_key: dedupeKey,
      finding_id: input.findingId,
      note: input.note,
      organization_id: input.organizationId,
      status: "open",
    });
  }
}

function toReviewerTaskRecord(
  task: EntityRecord["ReviewTask"],
): ReviewerTaskRecord {
  return {
    createdByUserId: task.created_by_user_id,
    findingId: task.finding_id,
    id: task.id,
    note: task.note ?? "",
    organizationId: task.organization_id,
    status: "open",
  };
}

serveBase44Function(async (request) => {
  const base44 = createClientFromRequest(request);
  const actor = buildWorkflowActor(await base44.auth.me());
  const body = await readJsonObject(request);
  const findingId = readRequiredString(body, "finding_id");
  const finding =
    await base44.asServiceRole.entities.Finding.get(findingId);
  const result = await createReviewerTask(
    {
      actor,
      findingId,
      findingOrganizationId: finding.organization_id,
      note: readRequiredString(body, "note"),
    },
    new Base44ReviewerTasks(base44),
  );
  return Response.json(result);
});
