import { useEffect, useState } from "react";

import { acknowledgeReceipt } from "../api/controlRoomGateway";
import { BrandMark } from "./BrandMark";

type AcknowledgementState = "error" | "loading" | "success";

export function AcknowledgementPage({ token }: { token: string }) {
  const [state, setState] = useState<AcknowledgementState>("loading");

  useEffect(() => {
    void acknowledgeReceipt(token).then(
      () => setState("success"),
      () => setState("error"),
    );
  }, [token]);

  if (state === "loading") {
    return <AcknowledgementLoading />;
  }

  return <AcknowledgementResult succeeded={state === "success"} />;
}

function AcknowledgementLoading() {
  return (
    <main className="centered-state" aria-busy="true">
      <BrandMark className="state-mark" />
      <span className="loading-orbit" aria-hidden="true" />
      <p>Recording your acknowledgement…</p>
    </main>
  );
}

function AcknowledgementResult({ succeeded }: { succeeded: boolean }) {
  return (
    <main className="centered-state">
      <BrandMark className="state-mark" />
      <p className="eyebrow">Recipient confirmation</p>
      <h1>{succeeded ? "Receipt acknowledged." : "This link is no longer valid."}</h1>
      <p>
        {succeeded
          ? "PolicyDiff recorded this receipt once and closed the delivery trail."
          : "The acknowledgement link may have expired or already been used."}
      </p>
      <a className="primary-button" href="/">Return to control room</a>
    </main>
  );
}
