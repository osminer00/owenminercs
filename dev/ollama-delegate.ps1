param(
    [Parameter(Mandatory = $true)]
    [string]$Prompt,
    [string]$Model = "",
    [string]$System = "You are a practical coding assistant for a static HTML/CSS/JS website. Be concise and output only the requested result.",
    [switch]$RawOutput
)

$ErrorActionPreference = "Stop"

if (-not $Model -or $Model.Trim().Length -eq 0) {
    if ($env:OLLAMA_MODEL -and $env:OLLAMA_MODEL.Trim().Length -gt 0) {
        $Model = $env:OLLAMA_MODEL.Trim()
    } else {
        $Model = "qwen3-coder:30b"
    }
}

$payload = @{
    model  = $Model
    prompt = $Prompt
    system = $System
    stream = $false
} | ConvertTo-Json -Depth 5

try {
    $response = Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:11434/api/generate" `
        -ContentType "application/json" `
        -Body $payload
} catch {
    throw "Could not reach Ollama at http://127.0.0.1:11434. Start it with 'ollama serve' and retry."
}

if ($RawOutput) {
    $response | ConvertTo-Json -Depth 6
    exit 0
}

if (-not $response.response) {
    throw "Ollama returned no response text. Confirm model '$Model' is installed."
}

$response.response.Trim()
