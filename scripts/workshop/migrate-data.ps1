<#
.SYNOPSIS
Copy the source MongoDB database into the Oracle MongoDB API target: mongodump from
SourceUri, then mongorestore --drop into TargetUri.

.DESCRIPTION
Run from the repo root:
  $env:TARGET_URI = 'mongodb://MERN26:<password>@<adb-host>:27017/mern26?loadBalanced=true&retryWrites=false&authMechanism=PLAIN&authSource=%24external&tls=true'
  .\scripts\workshop\migrate-data.ps1

Restores from <DumpDir>/<source database> (a URI that names a database needs the database
directory; the dump root restores 0 documents and still exits 0). Exits non-zero if
mongodump/mongorestore fail or 0 documents were restored. Credentials are masked in
everything this script prints.

.PARAMETER SourceUri
Source MongoDB URI naming the database. Default: $env:SOURCE_URI, else
mongodb://127.0.0.1:27017/mern_ecommerce.

.PARAMETER TargetUri
REQUIRED (or $env:TARGET_URI). Oracle MongoDB API URI naming database mern26. Write
$external as %24external (a literal $external is rewritten for you).

.PARAMETER DumpDir
Dump directory. Default: $env:DUMP_DIR, else ./dump.

Bash twin: scripts/workshop/migrate-data.sh (SOURCE_URI, TARGET_URI, DUMP_DIR).
Works on Windows PowerShell 5.1 and PowerShell 7.
#>
[CmdletBinding()]
param(
    [string]$SourceUri = $(if ($env:SOURCE_URI) { $env:SOURCE_URI } else { 'mongodb://127.0.0.1:27017/mern_ecommerce' }),
    [string]$TargetUri = $env:TARGET_URI,
    [string]$DumpDir = $(if ($env:DUMP_DIR) { $env:DUMP_DIR } else { './dump' })
)
$ErrorActionPreference = 'Stop'

function Hide-Credentials([string]$Text) {
    return ($Text -replace '//[^/]*@', '//***:***@')
}

function Get-DatabaseName([string]$Uri) {
    $m = [regex]::Match($Uri, '^[A-Za-z0-9+.\-]+://[^/]*/([^/?]+)')
    if ($m.Success) { return $m.Groups[1].Value }
    return ''
}

# Run a native command, echo its (credential-masked) output, return the output lines.
# Native stderr is merged without tripping $ErrorActionPreference = 'Stop' (Windows PowerShell 5.1).
function Invoke-Tool {
    param([string]$Exe, [string[]]$ArgList)
    $saved = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $lines = @()
    try {
        & $Exe @ArgList 2>&1 | ForEach-Object {
            $line = Hide-Credentials ($_.ToString())
            Write-Host $line
            $lines += $line
        }
        $script:ToolExit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $saved
    }
    return $lines
}

if (-not $TargetUri) { throw 'TargetUri / TARGET_URI is not set (Oracle MongoDB API URI naming database mern26)' }
foreach ($tool in 'mongodump', 'mongorestore') {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "$tool not found: install the MongoDB Database Tools"
    }
}

# $external -> %24external (the dollar sign must be percent-encoded in a URI)
$TargetUri = $TargetUri.Replace('$external', '%24external')

$SourceDb = Get-DatabaseName $SourceUri
$TargetDb = Get-DatabaseName $TargetUri
if (-not $SourceDb) { throw 'SourceUri must name the database (e.g. mongodb://127.0.0.1:27017/mern_ecommerce)' }
if (-not $TargetDb) { throw 'TargetUri must name the database mern26 (.../mern26?loadBalanced=true&...)' }
if ($TargetDb.ToLowerInvariant() -ne 'mern26') {
    Write-Warning "TargetUri names database '$TargetDb', not mern26."
}

Write-Host "Source: $(Hide-Credentials $SourceUri)  (database $SourceDb)"
Write-Host "Target: $(Hide-Credentials $TargetUri)  (database $TargetDb)"
Write-Host "Dump:   $DumpDir"

Write-Host ''
Write-Host '== mongodump =='
Invoke-Tool 'mongodump' @('--uri', $SourceUri, '--out', $DumpDir) | Out-Null
if ($script:ToolExit -ne 0) { throw "mongodump failed (exit $script:ToolExit)" }
$restoreDir = Join-Path $DumpDir $SourceDb
if (-not (Test-Path -LiteralPath $restoreDir -PathType Container)) {
    throw "mongodump produced no $restoreDir directory"
}

Write-Host ''
Write-Host '== mongorestore =='
$log = Invoke-Tool 'mongorestore' @('--drop', '--writeConcern', '{w:1}', '--uri', $TargetUri, $restoreDir)
if ($script:ToolExit -ne 0) { throw "mongorestore failed (exit $script:ToolExit)" }

$restored = 0
$failed = 0
foreach ($line in $log) {
    $m = [regex]::Match($line, '(\d+) document\(s\) restored successfully')
    if ($m.Success) { $restored = [int]$m.Groups[1].Value }
    $m = [regex]::Match($line, '(\d+) document\(s\) failed to restore')
    if ($m.Success) { $failed = [int]$m.Groups[1].Value }
}

Write-Host ''
if ($restored -le 0) {
    throw '0 documents restored: check that the URI names the database and DumpDir holds <db>/ (see the header)'
}
if ($failed -gt 0) { throw "$failed document(s) failed to restore" }
Write-Host "OK: $restored document(s) restored into $TargetDb."
