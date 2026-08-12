# =========================================================================
# SIGA — Servidor local de demonstração
# Serve os ficheiros desta pasta em http://localhost:5500 sem precisar de
# instalar nada (Python, Node, etc.) — usa apenas o .NET já incluído no
# Windows. Feche esta janela para desligar o servidor.
# =========================================================================

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$port = 5500

$mimeMap = @{
  '.html' = 'text/html; charset=utf-8'
  '.htm'  = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.gif'  = 'image/gif'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
  '.woff' = 'font/woff'
  '.woff2'= 'font/woff2'
  '.ttf'  = 'font/ttf'
  '.txt'  = 'text/plain; charset=utf-8'
  '.md'   = 'text/plain; charset=utf-8'
}

function Start-SigaServer {
  param([int]$Port)

  $listener = New-Object System.Net.HttpListener
  $prefix = "http://localhost:$Port/"
  $listener.Prefixes.Add($prefix)
  try {
    $listener.Start()
  } catch {
    Write-Host ""
    Write-Host "Nao foi possivel iniciar o servidor na porta $Port." -ForegroundColor Red
    Write-Host "Motivo: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Se outra copia deste servidor ja estiver aberta, feche essa janela primeiro."
    Read-Host "Prima ENTER para sair"
    exit 1
  }

  Write-Host "========================================================" -ForegroundColor Cyan
  Write-Host " SIGA - Sistema Integrado de Gestao Academica"           -ForegroundColor Cyan
  Write-Host " Servidor local ativo em: $prefix"                       -ForegroundColor Cyan
  Write-Host " Pasta servida: $root"
  Write-Host ""
  Write-Host " NAO FECHE esta janela enquanto estiver a fazer a demonstracao." -ForegroundColor Yellow
  Write-Host " Para desligar o servidor, feche esta janela ou prima Ctrl+C."
  Write-Host "========================================================" -ForegroundColor Cyan
  Write-Host ""

  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    try {
      $localPath = $request.Url.LocalPath
      if ($localPath -eq '/') { $localPath = '/index.html' }
      $localPath = $localPath -replace '/', '\'
      $filePath = Join-Path $root $localPath.TrimStart('\')
      $fullRoot = (Resolve-Path $root).Path
      $resolved = $null
      if (Test-Path -LiteralPath $filePath -PathType Leaf) {
        $resolved = (Resolve-Path -LiteralPath $filePath).Path
      }

      # protege contra pedidos que tentem sair da pasta do projeto
      if ($resolved -and $resolved.StartsWith($fullRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        $ext = [System.IO.Path]::GetExtension($resolved).ToLowerInvariant()
        $contentType = if ($mimeMap.ContainsKey($ext)) { $mimeMap[$ext] } else { 'application/octet-stream' }
        $bytes = [System.IO.File]::ReadAllBytes($resolved)
        $response.ContentType = $contentType
        $response.ContentLength64 = $bytes.Length
        $response.StatusCode = 200
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $response.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes('404 - Ficheiro nao encontrado')
        $response.ContentLength64 = $msg.Length
        $response.OutputStream.Write($msg, 0, $msg.Length)
      }
    } catch {
      try {
        $response.StatusCode = 500
        $msg = [System.Text.Encoding]::UTF8.GetBytes("Erro interno: $($_.Exception.Message)")
        $response.OutputStream.Write($msg, 0, $msg.Length)
      } catch {}
    } finally {
      $response.OutputStream.Close()
    }
  }
}

Start-SigaServer -Port $port
