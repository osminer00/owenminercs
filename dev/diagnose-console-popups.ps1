# Quick scan for common sources of cmd/powershell flashes (read-only)
$ErrorActionPreference = "SilentlyContinue"

Write-Host "=== User Startup folder ===" -ForegroundColor Cyan
Get-ChildItem "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup" | Select-Object Name, FullName

Write-Host "`n=== All-users Startup folder ===" -ForegroundColor Cyan
Get-ChildItem "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp" | Select-Object Name, FullName

Write-Host "`n=== HKCU Run ===" -ForegroundColor Cyan
Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" |
    Select-Object * -ExcludeProperty PS* |
    Format-List

Write-Host "`n=== HKLM Run (first 30 props) ===" -ForegroundColor Cyan
Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run" |
    Select-Object * -ExcludeProperty PS* |
    Format-List

Write-Host "`n=== Scheduled tasks: actions containing cmd/powershell/bat/ps1 (enabled) ===" -ForegroundColor Cyan
Get-ScheduledTask | Where-Object { $_.State -eq "Ready" -or $_.State -eq "Running" } | ForEach-Object {
    $task = $_
    foreach ($a in $task.Actions) {
        $exe = [string]$a.Execute
        $args = [string]$a.Arguments
        $line = ($exe + " " + $args).ToLowerInvariant()
        if ($line -match "cmd\.exe|powershell|pwsh|\.bat|\.cmd|\.ps1|wscript|cscript|conhost") {
            [PSCustomObject]@{
                Path     = $task.TaskPath
                Name     = $task.TaskName
                Execute  = $exe
                Arguments = if ($args.Length -gt 120) { $args.Substring(0, 120) + "..." } else { $args }
            }
        }
    }
} | Format-Table -AutoSize -Wrap

Write-Host "`n=== Tip: Use Sysinternals Procmon filter: Process Name is cmd.exe OR powershell.exe ===" -ForegroundColor Yellow
