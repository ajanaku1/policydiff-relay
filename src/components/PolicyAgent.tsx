import {
  type FormEvent,
  useState,
} from "react";
import type { AgentConversation } from "@base44/sdk";

import { base44 } from "../api/base44Client";
import {
  createReviewerTask,
  explainFinding,
} from "../api/controlRoomGateway";
import {
  formatFindingExplanation,
  type FindingExplanation,
  isGroundedAgentAnswer,
  isGroundedTaskConfirmation,
  isReviewerTaskRequest,
  toPlainAgentAnswer,
} from "../domain/policyOpsAnswer";
import type { FindingView } from "../types/controlRoom";

const agentPollIntervalMs = 1_000;
const agentPollLimit = 20;

interface AgentModel {
  finding: FindingView;
  isDemo: boolean;
}

export function PolicyAgent({ model }: { model: AgentModel }) {
  const agent = usePolicyAgent(model);
  return (
    <aside className="agent-card" aria-labelledby="agent-title">
      <AgentHeader />
      <p className="agent-answer" aria-live="polite">{agent.answer}</p>
      <AgentForm agent={agent} findingLabel={model.finding.label} />
      <small>Can explain findings and open reviewer tasks. Cannot approve or send.</small>
    </aside>
  );
}

function usePolicyAgent(model: AgentModel) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("Ask why a finding is blocked or what evidence a reviewer still needs.");
  const [isWorking, setIsWorking] = useState(false);
  const submit = (event: FormEvent) =>
    submitQuestion(event, model, question, setAnswer, setIsWorking, setQuestion);
  return { answer, isWorking, question, setQuestion, submit };
}

function AgentHeader() {
  return (
    <header>
      <span className="agent-glyph" aria-hidden="true">✦</span>
      <div><p className="eyebrow">Restricted agent</p><h2 id="agent-title">Policy Ops</h2></div>
    </header>
  );
}

type AgentState = ReturnType<typeof usePolicyAgent>;

function AgentForm({
  agent,
  findingLabel,
}: {
  agent: AgentState;
  findingLabel: string;
}) {
  return (
    <form onSubmit={(event) => void agent.submit(event)}>
      <label htmlFor="agent-question">Ask about {findingLabel}</label>
      <div>
        <input
          id="agent-question"
          onChange={(event) => agent.setQuestion(event.target.value)}
          placeholder="What evidence is missing?"
          type="text"
          value={agent.question}
        />
        <button disabled={agent.isWorking || !agent.question.trim()} type="submit">
          {agent.isWorking ? "…" : "Ask"}
        </button>
      </div>
    </form>
  );
}

async function submitQuestion(
  event: FormEvent,
  model: AgentModel,
  question: string,
  setAnswer: (answer: string) => void,
  setIsWorking: (isWorking: boolean) => void,
  setQuestion: (question: string) => void,
): Promise<void> {
  event.preventDefault();
  const prompt = question.trim();
  if (!prompt) return;
  setIsWorking(true);
  try {
    if (model.isDemo) {
      setAnswer(demoAnswer(model.finding));
    } else {
      setAnswer(await askPolicyOps(model.finding.id, prompt));
    }
    setQuestion("");
  } catch (error) {
    setAnswer(errorMessage(error));
  } finally {
    setIsWorking(false);
  }
}

async function askPolicyOps(
  findingId: string,
  question: string,
): Promise<string> {
  const explanation = await explainFinding(findingId);
  const answer = await askGroundedAgent(
    findingId,
    question,
    explanation,
  ).catch(() => undefined);
  if (isReviewerTaskRequest(question)) {
    if (answer && isGroundedTaskConfirmation(answer, explanation)) {
      return toPlainAgentAnswer(answer);
    }
    await createReviewerTask(findingId, question);
    return "Reviewer task opened with this request and the finding evidence attached.";
  }
  const fallback = formatFindingExplanation(explanation);
  return answer && isGroundedAgentAnswer(answer, explanation)
    ? toPlainAgentAnswer(answer)
    : fallback;
}

async function askGroundedAgent(
  findingId: string,
  question: string,
  explanation: FindingExplanation,
): Promise<string | undefined> {
  const conversation = await base44.agents.createConversation({
    agent_name: "policy_ops",
    metadata: { finding_id: findingId },
  });
  await base44.agents.addMessage(conversation, {
    content: buildAgentPrompt(findingId, question, explanation),
    role: "user",
  });
  return pollForAssistant(conversation.id);
}

function buildAgentPrompt(
  findingId: string,
  question: string,
  explanation: FindingExplanation,
): string {
  return [
    question,
    `Finding ID: ${findingId}`,
    "Call explainFinding with that exact ID before answering.",
    "Begin with the classification, then include the returned rationale and evidence excerpts exactly.",
    `Trusted boundary: ${JSON.stringify(explanation)}`,
  ].join("\n\n");
}

async function pollForAssistant(
  conversationId: string,
): Promise<string | undefined> {
  for (let attempt = 0; attempt < agentPollLimit; attempt += 1) {
    const conversation = await base44.agents.getConversation(conversationId);
    const answer = conversation && latestAssistantMessage(conversation);
    if (answer) return answer;
    await wait(agentPollIntervalMs);
  }
  return undefined;
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}

function latestAssistantMessage(conversation: AgentConversation): string {
  const message = [...conversation.messages]
    .reverse()
    .find(({ role }) => role === "assistant");
  return typeof message?.content === "string" ? message.content : "";
}

function demoAnswer(finding: FindingView): string {
  if (finding.classification === "uncertain") {
    return "The changed age clause is cited, but the source does not establish whether contractors count as applicants. Keep the finding uncertain and assign that classification question to a reviewer.";
  }
  return finding.rationale;
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Policy Ops could not answer this request.";
}
