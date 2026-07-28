# Base44 Workflows app rejects CLI automation deployment

Date observed: 2026-07-28

## Environment

- Base44 CLI: `base44@0.1.5`
- Linked app: `6a67e42b2e61581e8292a74a`
- App mode: Base44 Workflows enabled
- Local function configuration: documented `function.jsonc` `automations`
  blocks

## Minimal reproduction

1. Link the CLI project to a Base44 app with Workflows enabled.
2. Add a documented entity, scheduled, or connector automation to a function's
   `function.jsonc`.
3. Run `base44 functions deploy` or `base44 deploy`.

## Expected

The CLI documentation states that automations in `function.jsonc` deploy
atomically with their backend function.

## Actual

The function code bundles, but automation processing returns HTTP 409:

```text
This app uses Workflows — legacy automations are disabled for it.
reason: workflows_enabled
```

During a unified deployment, functions without automations deployed while
seven functions with automation blocks failed. The command still printed
`App deployed successfully` and returned success after the partial deployment.

## Impact

- A documented CLI project cannot deploy its triggers to an existing
  Workflows-enabled app.
- Unified deployment can appear successful even when multiple functions fail.
- The resulting app is partially deployed unless every per-function result is
  inspected.

## Workaround

PolicyDiff keeps the seven trigger specifications in source control, removes
legacy automation blocks only from generated deploy artifacts, deploys all
backend functions, and recreates the triggers as disabled Workflows through
the Base44 dashboard AI chat.

## Suggested upstream improvement

- Document the compatibility boundary between CLI automations and Workflows.
- Add a CLI or API surface for deploying Workflows.
- Return a non-zero exit code when any function fails during unified deploy.
