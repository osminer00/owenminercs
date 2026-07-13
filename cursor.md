# Cursor Guide

Read `AGENTS.md` first. It is the canonical low-token project memory entry point.

Use `memory/` for durable project state, preferences, issues, and decisions. Update those files when the user gives lasting site facts, bug patterns, ratios, workflow rules, or unresolved issues.

Cursor-specific note: use Agent mode from the project root `C:\owenminercs\owenminercs`. Before editing, check `memory/issues.md` for active bugs and `memory/preferences.md` for durable UI/site preferences.

**Copy rule:** Never add visible page text the user did not write without their explicit approval in chat. Propose first, edit second.

For usage optimization, prefer local Ollama delegation for lightweight tasks and keep cloud models for harder reasoning/risky changes. Use `.\dev\ollama-delegate.ps1` for local offload when it will not slow progress.

