# Release readiness

Checked: 2026-07-28

## Ready locally

- Vite production build
- 84 passing tests across 21 files
- strict backend and frontend TypeScript checks
- caller authorization on correction delivery
- revisioned approval for edited correction text
- Base44 entity and function type generation
- Drive automation scoped to the supplied Google Doc and kept inactive
- isolated Base44 function deploy packaging for Workflows-enabled apps
- desktop and mobile screenshots
- desktop and mobile interaction checks
- MIT license
- CI workflow
- judge-facing README
- 90-second demo runbook
- Drive and Gmail failure notes

## External checkpoints still required

1. Create the seven disabled dashboard Workflows from
   `base44/workflows/setup-prompt.md`.
2. Re-authenticate the reviewer so the new organization and policy-role claims
   are present in the session.
3. Activate the internal Workflows and, separately, the Drive Workflow.
4. Run the deployed journey without manual entity edits.

The Drive and Gmail connectors are authorized, both server secrets are set, all
17 functions and the site are deployed, and the v4 demo baseline is seeded.
The local Git repository has three verified commits. No real email, Workflow
activation, remote repository creation, or push has been performed.
