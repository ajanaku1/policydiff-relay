# PolicyDiff Relay Workflows setup prompt

Use this prompt in the linked Base44 app's dashboard AI chat.

> Create the following seven Workflows for PolicyDiff Relay. Keep every
> Workflow disabled after creation. Each Workflow must call the named backend
> function with the complete trigger payload so the function can validate and
> extract the source record or connector event.
>
> 1. `allowlisted_policy_file_update`: Google Drive `file.update` for file ID
>    `1yuUGKHKFE2QHcsU7h-0g7kkWATTRogvki-Ijau-cWxw`; call
>    `ingestPolicyVersion`.
> 2. `extract_new_policy_version`: when a `PolicyVersion` record is created;
>    call `extractPolicyClauses`.
> 3. `compare_extracted_policy_version`: when a `PolicyVersion` record is
>    updated and `status` equals `extracted`; call `comparePolicyVersions`.
> 4. `replay_activated_policy_version`: when a `PolicyVersion` record is
>    updated and `status` equals `active`; call `createReplayJob`.
> 5. `classify_replay_item`: when a `ReplayItem` record is created; call
>    `replayGuidance`.
> 6. `send_approved_correction`: when a `Delivery` record is created; call
>    `sendCorrection`.
> 7. `reconcile_delivery_backlog`: every five minutes; call
>    `reconcileDeliveries`.
>
> Do not send a test email, do not edit records, and do not enable any
> Workflow. After creation, summarize the trigger, function, conditions, and
> disabled status for all seven Workflows.
