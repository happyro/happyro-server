# HappyRO rAthena Agent Instructions

This repository is the HappyRO fork of rAthena. Preserve compatibility with upstream while keeping the LAN Web stack reproducible.

## Git

- Every HappyRO-authored commit must use `type(scope): subject`.
- The scope is mandatory, lowercase, and hyphen-separated when needed.
- Allowed types are `feat`, `fix`, `config`, `docs`, `refactor`, `test`, `build`, `ci`, `chore`, `perf`, `style`, and `revert`.
- Write the subject in imperative English, without a trailing period, and keep the complete first line at 72 characters or fewer.
- Examples: `config(packet): align the 20211103 protocol` and `docs(locale): record message review rules`.
- Use `type(scope)!: subject` for a breaking change and explain the migration in the commit body.
- Keep one logical change per commit. Upstream merge commits and upstream-authored commits are exempt from the HappyRO message format.
- Use `main` for HappyRO development. Push only to `origin`; never push to `upstream`.
- Do not commit or push unless the user explicitly asks.

## Server Invariants

- Keep `PACKETVER=20211103`, Renewal mode, packet obfuscation, and the roBrowserLegacy client configuration aligned.
- Preserve the rAthena `master` ancestry and keep HappyRO changes small enough to review during upstream merges.
- Prefer `conf/import/`, `db/import/`, `npc/custom/`, and `src/custom/` extension points over modifying upstream-owned defaults.
- Do not switch to a third-party rAthena fork or import translated NPC scripts as a shortcut.
- Treat official rAthena IDs, database schemas, message IDs, script behavior, and the verified kRO client structures as authoritative.
- Keep translations separate from script logic. Review NPC text item by item and preserve labels, variables, control flow, placeholders, color codes, and security-sensitive commands.
- Keep secrets, generated import configuration, build output, database data, logs, and runtime artifacts out of Git.
- Database changes require compatible SQL migration/import handling and verification against the pinned MariaDB development stack.

## Style And Verification

- Follow the repository `.editorconfig`, `.gitattributes`, existing C++ conventions, YAML spacing, and NPC script tab rules.
- Avoid unrelated formatting or modernization in upstream files.
- Run the focused test or parser for the changed subsystem and build all affected server binaries.
- For HappyRO runtime changes, run the root repository `make build-server`, `make server-verify`, or the closest focused check available.
- Never declare localization complete from translated line counts. Validate IDs, placeholders, encoding, fallback behavior, and representative in-game flows.
