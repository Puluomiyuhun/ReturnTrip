param([string]$RuntimeArchive, [string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$appRoot = Join-Path $repoRoot 'app'
$version = (Get-Content -Raw -LiteralPath (Join-Path $appRoot 'package.json') | ConvertFrom-Json).version
$runtimeVersion = '44.4.5'
$expectedHash = '11C395820A5AAA8EBCC0686B476D0AC98A730274EBFBDC8CF5538A7C2815CB5D'
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $repoRoot "dist/ReturnTrip-$version-win32-x64" }
$target = [System.IO.Path]::GetFullPath($OutputDirectory)
if ((Test-Path -LiteralPath $target) -or (Test-Path -LiteralPath "$target.zip")) { throw "Output already exists. Choose another -OutputDirectory: $target" }
& node (Join-Path $appRoot 'build.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Story build failed.' }
& node --test (Join-Path $appRoot 'test.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Tests failed.' }
if (-not $RuntimeArchive) {
    $cache = Join-Path $repoRoot '.cache'
    New-Item -ItemType Directory -Path $cache -Force | Out-Null
    $RuntimeArchive = Join-Path $cache "electron-v$runtimeVersion-win32-x64.zip"
    if (-not (Test-Path -LiteralPath $RuntimeArchive)) {
        Invoke-WebRequest -Uri "https://github.com/electron/electron/releases/download/v$runtimeVersion/electron-v$runtimeVersion-win32-x64.zip" -OutFile $RuntimeArchive -UseBasicParsing
    }
}
$runtimePath = (Resolve-Path -LiteralPath $RuntimeArchive).Path
if ((Get-FileHash -LiteralPath $runtimePath -Algorithm SHA256).Hash -ne $expectedHash) { throw 'Electron archive SHA-256 does not match the pinned release.' }
New-Item -ItemType Directory -Path $target -Force | Out-Null
Expand-Archive -LiteralPath $runtimePath -DestinationPath $target
$electronExe = Join-Path $target 'electron.exe'
if (-not (Test-Path -LiteralPath $electronExe)) { throw 'Missing Electron executable.' }
# Rename only the executable just extracted into this explicitly selected output directory.
Rename-Item -LiteralPath $electronExe -NewName ([string][char]0x56DE + [char]0x7A0B + '.exe')
Copy-Item -LiteralPath $appRoot -Destination (Join-Path $target 'resources/app') -Recurse
Copy-Item -LiteralPath (Join-Path $repoRoot 'README.md') -Destination $target
Compress-Archive -LiteralPath $target -DestinationPath "$target.zip" -CompressionLevel Optimal
$hash = (Get-FileHash -LiteralPath "$target.zip" -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath "$target.zip.sha256.txt" -Value "$hash  $([System.IO.Path]::GetFileName($target)).zip" -Encoding ascii
Write-Output "Built: $target.zip"
