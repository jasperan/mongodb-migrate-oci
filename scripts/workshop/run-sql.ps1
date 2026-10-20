<#
.SYNOPSIS
Run one or more sql/26ai scripts in SQLcl against Autonomous AI Database (TLS, no wallet).

.DESCRIPTION
Run from the repo root:
  .\scripts\workshop\run-sql.ps1 -User ADMIN -File sql/26ai/01_schemas.sql
  .\scripts\workshop\run-sql.ps1 -User MERN26 -File sql/26ai/04_relational_views.sql,sql/26ai/07_validity_views.sql

Environment:
  ORACLE_CONNECT_STRING  REQUIRED. TLS connect string from the ADB console (no wallet).
  DB_PASSWORD            password of ADMIN (and of any other -User). No double quote.
  MERN26_PASSWORD        password used when -User is MERN26
  MERN26DV_PASSWORD      password used when -User is MERN26DV
                         The password is chosen per user; it is prompted (hidden) if the selected
                         variable is unset, so one terminal can run the whole workshop.

SQL substitution variables the sql/26ai scripts need, supplied from env when set (an unset
variable is simply not defined, so the script's own default applies):
  MERN26_PASSWORD    -> define mern26_password     01_schemas.sql (required; prompted for 01 if unset)
  MERN26DV_PASSWORD  -> define mern26dv_password   01_schemas.sql (required; prompted for 01 if unset)
  MERN_LLM_KEY       -> define mern_llm_key        09_select_ai.sql (OCI Generative AI API key). 09 reads
                        it from the gitignored sql/26ai/09_select_ai_key.sql; if that file is absent
                        it is written for the run and removed afterwards. An existing file wins.
  MERN_LLM_REGION    -> define mern_llm_region     09b_select_ai_acl.sql (default us-phoenix-1)
  EMBEDDING_DIM      -> define embedding_dim       08_ai_vector_store.sql (default 384)
Scripts with no variables (02, 03, 03b, 04-07, 10) need none. Secret values must not contain
a double quote or a newline; the variables defined for the SQL scripts (everything but
DB_PASSWORD) also no whitespace.

Needs SQLcl 25.2+ (`sql`) on PATH. Each script runs after `whenever sqlerror exit failure`
(a script's own `whenever` overrides it for that script); exits non-zero on SQL error.
Passwords travel on SQLcl's stdin, never on its command line.

.PARAMETER User
Database user to connect as (ADMIN, MERN26 or MERN26DV).

.PARAMETER File
One or more SQL files, run in order.

Bash twin: scripts/workshop/run-sql.sh <DB_USER> <file.sql> [...].
Works on Windows PowerShell 5.1 and PowerShell 7.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$User,
    [Parameter(Mandatory = $true)][string[]]$File
)
$ErrorActionPreference = 'Stop'

function Read-Secret([string]$Prompt) {
    $secure = Read-Host -Prompt $Prompt -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

function Assert-Secret([string]$Name, [string]$Value, [switch]$NoWhitespace) {
    if ($Value -match '["\r\n]') { throw "$Name must not contain a double quote or a newline" }
    if ($NoWhitespace -and $Value -match '\s') { throw "$Name must not contain whitespace" }
}

if (-not $env:ORACLE_CONNECT_STRING) {
    throw 'ORACLE_CONNECT_STRING is not set (TLS connect string from the ADB console)'
}
if (-not (Get-Command sql -ErrorAction SilentlyContinue)) { throw "SQLcl ('sql') not found on PATH" }
foreach ($f in $File) {
    if (-not (Test-Path -LiteralPath $f -PathType Leaf)) { throw "SQL file not found: $f" }
}

switch ($User.ToUpperInvariant()) {
    'MERN26'   { $dbPassword = $env:MERN26_PASSWORD }
    'MERN26DV' { $dbPassword = $env:MERN26DV_PASSWORD }
    default    { $dbPassword = $env:DB_PASSWORD }
}
if (-not $dbPassword) { $dbPassword = Read-Secret "Password for ${User}" }
Assert-Secret 'DB_PASSWORD' $dbPassword

$mern26Password = $env:MERN26_PASSWORD
$mern26dvPassword = $env:MERN26DV_PASSWORD
foreach ($f in $File) {
    if ((Split-Path -Leaf $f) -eq '01_schemas.sql') {
        if (-not $mern26Password) { $mern26Password = Read-Secret 'MERN26 password' }
        if (-not $mern26dvPassword) { $mern26dvPassword = Read-Secret 'MERN26DV password' }
    }
}

$defines = @(
    @{ Var = 'MERN26_PASSWORD';   Name = 'mern26_password';   Value = $mern26Password }
    @{ Var = 'MERN26DV_PASSWORD'; Name = 'mern26dv_password'; Value = $mern26dvPassword }
    @{ Var = 'MERN_LLM_REGION';   Name = 'mern_llm_region';   Value = $env:MERN_LLM_REGION }
    @{ Var = 'EMBEDDING_DIM';     Name = 'embedding_dim';     Value = $env:EMBEDDING_DIM }
)
foreach ($d in $defines) {
    if ($d.Value) { Assert-Secret $d.Var $d.Value -NoWhitespace }
}
if ($env:MERN_LLM_KEY) { Assert-Secret 'MERN_LLM_KEY' $env:MERN_LLM_KEY -NoWhitespace }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$keyFile = 'sql/26ai/09_select_ai_key.sql'
$createdKeyFile = $false
$exitCode = 1
try {
    if ($env:MERN_LLM_KEY) {
        if (Test-Path -LiteralPath $keyFile) {
            Write-Warning "$keyFile exists and takes precedence over MERN_LLM_KEY."
        } elseif (Test-Path -LiteralPath 'sql/26ai' -PathType Container) {
            $content = "set define off`ndefine mern_llm_key = $($env:MERN_LLM_KEY)`nset define on`n"
            [System.IO.File]::WriteAllText((Join-Path (Get-Location).Path $keyFile), $content, $utf8NoBom)
            $createdKeyFile = $true
        }
    }

    $sqlLines = New-Object System.Collections.Generic.List[string]
    $sqlLines.Add('set define off')
    foreach ($d in $defines) {
        if ($d.Value) { $sqlLines.Add("define $($d.Name) = $($d.Value)") }
    }
    $sqlLines.Add('set define on')
    $sqlLines.Add('whenever oserror exit failure')
    $sqlLines.Add('whenever sqlerror exit failure')
    $sqlLines.Add("connect $User/`"$dbPassword`"@$($env:ORACLE_CONNECT_STRING)")
    foreach ($f in $File) {
        $sqlLines.Add('whenever sqlerror exit failure')
        if ($f -match '\s') { $sqlLines.Add("@`"$f`"") } else { $sqlLines.Add("@$f") }
    }
    $sqlLines.Add('exit')

    $OutputEncoding = $utf8NoBom
    $saved = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $sqlLines | & sql -S /nolog
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $saved
    }
} finally {
    if ($createdKeyFile) { Remove-Item -LiteralPath $keyFile -Force -ErrorAction SilentlyContinue }
}
if ($exitCode -ne 0) { throw "SQLcl exited with code $exitCode" }
