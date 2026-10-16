<#
.SYNOPSIS
Start (or reuse) the source MongoDB for the migration: container "mern-mongo" from
mongo:7, published on 127.0.0.1:27017 only.

.DESCRIPTION
Run from the repo root:
  .\scripts\workshop\start-source-mongo.ps1          # run or reuse the container, wait for ping
  .\scripts\workshop\start-source-mongo.ps1 -Stop    # remove the container

.PARAMETER Engine
docker or podman. Default: $env:CONTAINER_ENGINE, else docker if its daemon answers, else podman.

.PARAMETER Stop
Remove the container instead of starting it.

Bash twin: scripts/workshop/start-source-mongo.sh (CONTAINER_ENGINE, "stop").
Works on Windows PowerShell 5.1 and PowerShell 7.
#>
[CmdletBinding()]
param(
    [string]$Engine = $env:CONTAINER_ENGINE,
    [switch]$Stop
)
$ErrorActionPreference = 'Stop'

$Name = 'mern-mongo'
$Image = 'mongo:7'
$PortMap = '127.0.0.1:27017:27017'

# Run a native command, return its stdout lines; never throws on stderr (Windows PowerShell 5.1
# turns redirected native stderr into errors under $ErrorActionPreference = 'Stop').
function Invoke-Engine {
    param([string[]]$ArgList)
    $saved = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $out = & $script:Engine @ArgList 2>&1 | ForEach-Object { $_.ToString() }
        $script:EngineExit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $saved
    }
    return $out
}

function Test-Command([string]$Cmd) {
    return [bool](Get-Command $Cmd -ErrorAction SilentlyContinue)
}

if ($Engine) {
    if (-not (Test-Command $Engine)) { throw "-Engine/CONTAINER_ENGINE '$Engine' not found on PATH" }
} else {
    $Engine = $null
    if (Test-Command 'docker') {
        $saved = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        & docker info 2>&1 | Out-Null
        $dockerOk = ($LASTEXITCODE -eq 0)
        $ErrorActionPreference = $saved
        if ($dockerOk) { $Engine = 'docker' }
    }
    if (-not $Engine -and (Test-Command 'podman')) { $Engine = 'podman' }
    if (-not $Engine) { throw 'no container engine found: install Docker or Podman (or start the Docker daemon)' }
}

function Test-ContainerExists([switch]$RunningOnly) {
    $a = @('ps')
    if (-not $RunningOnly) { $a += '-a' }
    $a += @('--filter', "name=^$Name`$", '--format', '{{.Names}}')
    $names = Invoke-Engine $a
    return [bool]($names | Where-Object { $_ -eq $Name })
}

if ($Stop) {
    if (Test-ContainerExists) {
        Invoke-Engine @('rm', '-f', $Name) | Out-Null
        if ($script:EngineExit -ne 0) { throw "$Engine rm -f $Name failed" }
        Write-Host "Removed container $Name ($Engine)."
    } else {
        Write-Host "Container $Name does not exist; nothing to do."
    }
    exit 0
}

if (Test-ContainerExists) {
    if (Test-ContainerExists -RunningOnly) {
        Write-Host "Reusing running container $Name ($Engine)."
    } else {
        Write-Host "Starting existing container $Name ($Engine)."
        Invoke-Engine @('start', $Name) | Out-Null
        if ($script:EngineExit -ne 0) { throw "$Engine start $Name failed" }
    }
} else {
    Write-Host "Creating container $Name from $Image ($Engine)."
    $out = Invoke-Engine @('run', '-d', '--name', $Name, '-p', $PortMap, $Image)
    if ($script:EngineExit -ne 0) { throw "$Engine run failed: $($out -join ' ')" }
}

Write-Host -NoNewline 'Waiting for MongoDB to answer ping'
for ($i = 0; $i -lt 60; $i++) {
    $out = Invoke-Engine @('exec', $Name, 'mongosh', '--quiet', '--eval', 'db.adminCommand({ping:1}).ok')
    if ($script:EngineExit -eq 0 -and (($out -join '').Trim() -eq '1')) {
        Write-Host ''
        Write-Host 'MongoDB is ready: mongodb://127.0.0.1:27017'
        exit 0
    }
    Write-Host -NoNewline '.'
    Start-Sleep -Seconds 2
}
Write-Host ''
throw "MongoDB did not answer ping within 120 seconds; check: $Engine logs $Name"
