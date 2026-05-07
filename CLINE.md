# Cline Guide

Read `AGENTS.md` first. It is the canonical low-token project memory entry point.

Use `memory/` for durable project state, preferences, issues, and decisions. Update those files when the user gives lasting site facts, bug patterns, ratios, workflow rules, or unresolved issues.

## Local Ollama Models

Cline is configured to use local Ollama models on the RTX 4090. This reduces hosted API usage for lightweight tasks.

### Available Models

Check what models you have installed:

```powershell
ollama list
```

### Cline Configuration

Cline uses the **OpenAI Compatible** API endpoint to connect to Ollama:

1. Open Cline settings in VS Code
2. Set **API Provider** to `OpenAI Compatible`
3. Set **Base URL** to `http://localhost:11434/v1`
4. Set **Model** to one of your installed Ollama models (e.g., `qwen3-coder:30b`)
5. API key can be left blank or set to any value (not used by Ollama)

### Delegation Policy

- **Local Ollama**: First drafts, copy edits, repetitive transforms, extraction/summarization, simple boilerplate, test stubs
- **Cloud models**: High-risk edits, architecture decisions, production-sensitive logic, final verification

Use the helper script for delegation:

```powershell
.\dev\ollama-delegate.ps1 -Prompt "Your prompt here"
```

### If Ollama Isn't Running

```powershell
ollama serve
```

Then restart Cline or refresh the connection.
