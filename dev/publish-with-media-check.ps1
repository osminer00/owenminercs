param(
  [Parameter(Mandatory = $false)]
  [string]$PublishCommand = ""
)

$ErrorActionPreference = "Stop"

Write-Host "Running pre-publish media accessibility preview..." -ForegroundColor Cyan
node "dev/media-accessibility-check.mjs"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Preview check failed. Publish cancelled." -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Review the suggestions above before publishing." -ForegroundColor Yellow
$confirmation = Read-Host "Type PUBLISH to continue"
if ($confirmation -ne "PUBLISH") {
  Write-Host "Publish cancelled." -ForegroundColor Yellow
  exit 1
}

if ([string]::IsNullOrWhiteSpace($PublishCommand)) {
  Write-Host "Confirmed. No publish command provided." -ForegroundColor Green
  Write-Host "Run again with -PublishCommand, for example:" -ForegroundColor Gray
  Write-Host '  .\dev\publish-with-media-check.ps1 -PublishCommand "netlify deploy --prod"' -ForegroundColor Gray
  exit 0
}

Write-Host ""
Write-Host "Running publish command:" -ForegroundColor Cyan
Write-Host $PublishCommand -ForegroundColor White
Invoke-Expression $PublishCommand
exit $LASTEXITCODE
