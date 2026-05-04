param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("up", "down", "restart", "logs", "status", "reset")]
  [string]$Command
)

$ErrorActionPreference = "Stop"

$containerName = "lt-slide-editor-postgres"
$image = "postgres:16"
$user = "postgres"
$password = "postgres"
$database = "lt_slide_editor"
$port = "5432"

function Test-Docker {
  docker version | Out-Null
}

function Get-ContainerId {
  docker ps -aq --filter "name=^/$containerName$"
}

function Start-Db {
  Test-Docker
  $containerId = Get-ContainerId

  if ($containerId) {
    $running = docker inspect -f "{{.State.Running}}" $containerName
    if ($running -eq "true") {
      Write-Host "PostgreSQL is already running: $containerName"
      Wait-ForDb
      return
    }

    docker start $containerName | Out-Null
    Write-Host "Started existing PostgreSQL container: $containerName"
    Wait-ForDb
    return
  }

  docker run `
    --name $containerName `
    -e "POSTGRES_USER=$user" `
    -e "POSTGRES_PASSWORD=$password" `
    -e "POSTGRES_DB=$database" `
    -p "${port}:5432" `
    -d $image | Out-Null

  Write-Host "Created and started PostgreSQL container: $containerName"
  Wait-ForDb
}

function Wait-ForDb {
  Write-Host "Waiting for PostgreSQL to accept connections..."

  for ($attempt = 1; $attempt -le 30; $attempt++) {
    docker exec $containerName pg_isready -U $user -d $database | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Write-Host "PostgreSQL is ready."
      return
    }

    Start-Sleep -Seconds 1
  }

  throw "PostgreSQL did not become ready in time."
}

function Stop-Db {
  $containerId = Get-ContainerId
  if (-not $containerId) {
    Write-Host "PostgreSQL container does not exist: $containerName"
    return
  }

  docker stop $containerName | Out-Null
  Write-Host "Stopped PostgreSQL container: $containerName"
}

function Restart-Db {
  Stop-Db
  Start-Db
}

function Show-Logs {
  Test-Docker
  docker logs -f $containerName
}

function Show-Status {
  Test-Docker
  docker ps -a --filter "name=^/$containerName$"
  Write-Host ""
  Write-Host "DATABASE_URL=postgresql://${user}:${password}@localhost:${port}/${database}?schema=public"
}

function Reset-Db {
  $containerId = Get-ContainerId
  if ($containerId) {
    docker rm -f $containerName | Out-Null
    Write-Host "Removed PostgreSQL container: $containerName"
  }

  Start-Db
}

switch ($Command) {
  "up" { Start-Db }
  "down" { Stop-Db }
  "restart" { Restart-Db }
  "logs" { Show-Logs }
  "status" { Show-Status }
  "reset" { Reset-Db }
}
