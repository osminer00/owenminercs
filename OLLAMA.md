# Ollama Guide

Read `AGENTS.md` first. Use `memory/` for durable project state, preferences, issues, and decisions.

Keep this file short so local models do not spend context on duplicated docs.

## Local-First Delegation Policy

- Goal: reduce hosted API usage by delegating low-risk tasks to local Ollama on the RTX 4090.
- Keep cloud models enabled for high-risk edits, architecture decisions, production-sensitive logic, and final verification passes.
- Prefer local for first drafts, copy edits, repetitive transforms, extraction/summarization, simple boilerplate, and test stub generation.

## AI Assistant Configuration

### Cline (VS Code Extension)

Configure Cline to use local Ollama models:

1. Open Cline settings in VS Code
2. Set **API Provider** to `OpenAI Compatible`
3. Set **Base URL** to `http://localhost:11434/v1`
4. Set **Model** to your installed Ollama model (e.g., `qwen3-coder:30b`)
5. API key can be left blank (not used by Ollama)

See `CLINE.md` and `.clinerules` for full Cline configuration.

## Default Local Delegation Command

Use the helper script:

```powershell
.\dev\ollama-delegate.ps1 -Prompt "Summarize this file and list safe refactors"
```

Optional flags:

```powershell
.\dev\ollama-delegate.ps1 -Model qwen2.5-coder:14b -Prompt "..."
.\dev\ollama-delegate.ps1 -System "You are a concise web dev assistant." -Prompt "..."
.\dev\ollama-delegate.ps1 -RawOutput -Prompt "..."
```

## Notes

- The helper defaults to model `qwen3-coder:30b` unless overridden by `-Model` or `OLLAMA_MODEL`.
- If Ollama is not running, start it first:

```powershell
ollama serve
```

