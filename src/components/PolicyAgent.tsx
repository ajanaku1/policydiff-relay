import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import type { AgentConversation } from "@base44/sdk";

import { base44 } from "../api/base44Client";
import type { FindingView } from "../types/controlRoom";

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
  const unsubscribe = useRef<() => void>(() => undefined);
  useEffect(() => () => unsubscribe.current(), []);
  const submit = (event: FormEvent) =>
    submitQuestion(event, {
      answer: setAnswer,
      isWorking: setIsWorking,
      model,
      question,
      resetQuestion: () => setQuestion(""),
      unsubscribe,
    });
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

interface SubmitContext {
  answer: Dispatch<SetStateAction<string>>;
  isWorking: Dispatch<SetStateAction<boolean>>;
  model: AgentModel;
  question: string;
  resetQuestion: () => void;
  unsubscribe: { current: () => void };
}

async function submitQuestion(
  event: FormEvent,
  context: SubmitContext,
): Promise<void> {
  event.preventDefault();
  if (!context.question.trim()) return;
  context.isWorking(true);
  try {
    if (context.model.isDemo) {
      context.answer(demoAnswer(context.model.finding));
    } else {
      await askAgent(context.model.finding.id, context.question, context.answer, context.unsubscribe);
    }
    context.resetQuestion();
  } catch (error) {
    context.answer(errorMessage(error));
  } finally {
    context.isWorking(false);
  }
}

async function askAgent(
  findingId: string,
  question: string,
  setAnswer: (value: string) => void,
  unsubscribe: { current: () => void },
): Promise<void> {
  const conversation = await base44.agents.createConversation({
    agent_name: "policy_ops",
    metadata: { finding_id: findingId },
  });
  unsubscribe.current();
  unsubscribe.current = subscribeForAnswer(conversation.id, setAnswer);
  setAnswer("Policy Ops is tracing the cited evidence…");
  await base44.agents.addMessage(conversation, {
    content: `${question}\n\nFinding ID: ${findingId}`,
    role: "user",
  });
}

function subscribeForAnswer(
  conversationId: string,
  setAnswer: (value: string) => void,
): () => void {
  return base44.agents.subscribeToConversation(conversationId, (conversation) => {
    const response = latestAssistantMessage(conversation);
    if (response) setAnswer(response);
  });
}

function latestAssistantMessage(conversation: AgentConversation): string {
  const message = [...conversation.messages]
    .reverse()
    .find((candidate) => candidate.role === "assistant");
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
