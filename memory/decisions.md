# Decisions

Last reviewed: 2026-04-28

## 2026-04-28 - Shared Memory Spine

Decision: Use `AGENTS.md` as the canonical low-token entry point and `memory/` as the shared durable memory layer.

Why:

- The repo has multiple platform-specific memory files.
- Duplicating full instructions into every platform burns tokens and goes stale.
- A single read order lets each assistant load only what it needs.

Expected behavior:

- Platform files stay short and point to `AGENTS.md`.
- Lasting preferences, bugs, ratios, and site facts go in `memory/`.
- Old handoffs move toward archive/active organization over time.

