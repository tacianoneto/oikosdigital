# Mantem o backend (npm run dev:server) + Cloudflare quick tunnel sempre no ar.
# Reinicia automaticamente se cair. Roda escondido pela tarefa agendada do logon.
#
# Logs:
#   logs\serve-tunnel.log  -> saida completa (server + tunnel)
#   logs\link-atual.txt    -> link de teste atual (frontend Netlify + ?server=<tunnel>)
#
# A URL do quick tunnel muda a cada reinicio: consulte logs\link-atual.txt
# sempre que precisar do link para compartilhar.

$ErrorActionPreference = "Continue"

$repoRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $repoRoot "logs"
$log = Join-Path $logDir "serve-tunnel.log"
$linkFile = Join-Path $logDir "link-atual.txt"
$frontend = "https://oikosdigital.netlify.app"

if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}

Set-Location $repoRoot

$urlRe = [regex] 'https://[a-z0-9-]+\.trycloudflare\.com'

while ($true) {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "[$stamp] iniciando npm run serve:tunnel" | Out-File -Append -Encoding utf8 $log

  # cmd /c resolve o shim npm.cmd e mantem o PATH do usuario.
  & cmd /c "npm run serve:tunnel" 2>&1 | ForEach-Object {
    $line = $_
    $line | Out-File -Append -Encoding utf8 $log
    $m = $urlRe.Match([string]$line)
    if ($m.Success) {
      "$frontend/?server=$($m.Value)" | Out-File -Encoding utf8 $linkFile
    }
  }

  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "[$stamp] processo encerrou; reiniciando em 5s" | Out-File -Append -Encoding utf8 $log
  Start-Sleep -Seconds 5
}
