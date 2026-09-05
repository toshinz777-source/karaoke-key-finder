# Project Privacy & Security Rules

These rules apply to all work in this project and take precedence over convenience or task speed.

## Never access secrets or environment variables

Do not read, print, inspect, copy, summarize, or modify any of the following, under any
circumstances, even if a task seems to require it:

- `.env`, `.env.*`, or any environment/config file holding secrets
- Environment variables of any kind (do not run `env`, `printenv`, or echo them)
- API keys, tokens, passwords, credentials
- SSH keys (`id_rsa`, `id_ed25519`, anything under `.ssh/`)
- Any file whose name or path suggests it holds a secret (`*secret*`, `*credential*`,
  `*token*`, `*apikey*`)
- Any file outside this project's directory, unless the user has explicitly approved it
  for that specific request

Enforcement for these rules is also configured in `.claude/settings.json` (permission
deny rules), but the deny list cannot be assumed to be exhaustive. Treat this document as
the standing instruction regardless of what the settings file does or doesn't catch.

## Stop and ask first

Before taking any action that would touch something sensitive as described above —
including a file that merely looks like it might be one — stop and ask the user for
explicit confirmation before proceeding. Do not guess or proceed "just to check."

## This ToDo app specifically

- No environment variables. Configuration, if any, lives in plain project files, not `.env`.
- No API keys.
- No external services, network calls, or third-party APIs. The app must work fully
  offline using only local data (e.g. browser storage or a local file/database).
