# Base44 User schema `name` validation gap

Status: reproduced locally; not posted upstream
Date: 2026-07-28

## Environment

- Base44 CLI 0.1.5
- Node 26.5.0
- Linked Base44 backend project

## Minimal reproduction

1. Create `base44/entities/User.json` using the official User extension example:
   include `type`, `properties`, and `required`, but omit `name`.
2. Run `base44 types generate`.

## Expected

The User extension validates because the official documentation says the file
contains only custom fields and its example omits `name`.

## Actual

The CLI exits with:

```text
Invalid entity file in base44/entities/User.json:
Invalid input: expected string, received undefined
at name
```

## Impact

A project copied from the official User schema example cannot pass local CLI
validation.

## Workaround

Add `"name": "User"` to the extension schema. Keep built-in User properties out
of the file.

## Upstream request

Either make `name` optional for `User.json` or add `"name": "User"` to the
official example and field guidance.
