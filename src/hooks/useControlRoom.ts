import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { base44 } from "../api/base44Client";
import {
  approveFinding,
  beginSignIn,
  createAuditPacket,
  createReviewerTask,
  isAuthenticationRequired,
  loadControlRoom,
  sendCorrection,
} from "../api/controlRoomGateway";
import type {
  AsyncActionState,
  ControlRoomSnapshot,
  FindingView,
} from "../types/controlRoom";

const idleAction: AsyncActionState = { kind: "idle", message: "" };

export function useControlRoom() {
  const room = useRoomState();
  const selected = useMemo(
    () => room.snapshot?.findings.find((finding) => finding.id === room.selectedId),
    [room.selectedId, room.snapshot],
  );
  const { action, actions } = useRoomActions(room, selected);
  return { ...room, action, actions, selected };
}

function useRoomState() {
  const [snapshot, setSnapshot] = useState<ControlRoomSnapshot>();
  const [selectedId, setSelectedId] = useState("");
  const [loadError, setLoadError] = useState("");
  const [signInRequired, setSignInRequired] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const next = await loadControlRoom();
      setSnapshot(next);
      setSelectedId((current) => current || next.findings[0]?.id || "");
      setLoadError("");
      setSignInRequired(false);
    } catch (error) {
      setLoadError(errorMessage(error));
      setSignInRequired(isAuthenticationRequired(error));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => subscribeToWorkflow(snapshot, refresh), [snapshot?.source, refresh]);
  return {
    loadError,
    refresh,
    selectedId,
    setSelectedId,
    setSnapshot,
    signInRequired,
    snapshot,
  };
}

function useRoomActions(
  room: ReturnType<typeof useRoomState>,
  selected: FindingView | undefined,
) {
  const [action, setAction] = useState<AsyncActionState>(idleAction);
  const context: ActionContext = { ...room, selected, setAction };
  const actions = {
    approve: (correctionText: string) =>
      approveAction(context, correctionText),
    createTask: () => reviewerTaskAction(context),
    exportAudit: () => auditAction(context),
    refresh: room.refresh,
    send: () => sendAction(context),
    signIn: beginSignIn,
  };
  return { action, actions };
}

interface ActionContext {
  refresh: () => Promise<void>;
  selected: FindingView | undefined;
  setAction: Dispatch<SetStateAction<AsyncActionState>>;
  setSnapshot: Dispatch<SetStateAction<ControlRoomSnapshot | undefined>>;
  snapshot: ControlRoomSnapshot | undefined;
}

function approveAction(
  context: ActionContext,
  correctionText: string,
): Promise<void> {
  return runAction(context, "Approval recorded. Delivery is queued.", async () => {
    const { selected, snapshot } = context;
    if (!selected || !snapshot) return;
    if (snapshot.source === "demo") {
      context.setSnapshot(patchDemoFinding(snapshot, selected.id, { status: "approved" }));
      return;
    }
    await approveFinding(selected.id, correctionText);
  });
}

function reviewerTaskAction(context: ActionContext): Promise<void> {
  return runAction(context, "Reviewer task opened with the evidence gap attached.", async () => {
    const { selected, snapshot } = context;
    if (!selected || !snapshot) return;
    if (snapshot.source === "demo") {
      context.setSnapshot(patchDemoFinding(snapshot, selected.id, { taskStatus: "open" }));
      return;
    }
    await createReviewerTask(selected.id, selected.rationale);
  });
}

function sendAction(context: ActionContext): Promise<void> {
  return runAction(context, "Correction sent. Waiting for acknowledgement.", async () => {
    const { selected, snapshot } = context;
    if (!selected?.deliveryId || !snapshot) return;
    if (snapshot.source === "demo") {
      context.setSnapshot(patchDemoFinding(snapshot, selected.id, { deliveryStatus: "sent" }));
      return;
    }
    await sendCorrection(selected.deliveryId);
  });
}

async function auditAction(context: ActionContext): Promise<void> {
  const { snapshot } = context;
  if (!snapshot) return;
  if (snapshot.source === "demo") {
    context.setAction({
      kind: "error",
      message: "Audit export is available after signing into the Base44 app.",
    });
    return;
  }
  await runAction(context, "Private audit packet opened.", () =>
    openAuditPacket(snapshot.actor.organizationId)
  );
}

async function openAuditPacket(organizationId: string): Promise<void> {
  const packet = await createAuditPacket(organizationId);
  window.open(packet.signedUrl, "_blank", "noopener,noreferrer");
}

async function runAction(
  context: ActionContext,
  successMessage: string,
  task: () => Promise<void>,
): Promise<void> {
  context.setAction({ kind: "working", message: "Applying the trusted transition…" });
  try {
    await task();
    context.setAction({ kind: "success", message: successMessage });
    if (context.snapshot?.source === "base44") await context.refresh();
  } catch (error) {
    context.setAction({ kind: "error", message: errorMessage(error) });
  }
}

function subscribeToWorkflow(
  snapshot: ControlRoomSnapshot | undefined,
  refresh: () => Promise<void>,
): () => void {
  if (snapshot?.source !== "base44") return () => undefined;
  const onChange = () => void refresh();
  const unsubscribers = [
    base44.entities.Finding.subscribe(onChange),
    base44.entities.Approval.subscribe(onChange),
    base44.entities.Delivery.subscribe(onChange),
    base44.entities.Acknowledgement.subscribe(onChange),
    base44.entities.ReviewTask.subscribe(onChange),
  ];
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

function patchDemoFinding(
  snapshot: ControlRoomSnapshot,
  findingId: string,
  patch: Partial<FindingView>,
): ControlRoomSnapshot {
  return {
    ...snapshot,
    findings: snapshot.findings.map((finding) =>
      finding.id === findingId ? { ...finding, ...patch } : finding
    ),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The workflow could not be updated. Try again.";
}
