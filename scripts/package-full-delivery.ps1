param(
  [string]$OutputPath = "隧洞数字孪生系统_完整源码数据交付包_20260911.zip"
)

$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputFull = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
  [System.IO.Path]::GetFullPath($OutputPath)
} else {
  [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputPath))
}

if (Test-Path -LiteralPath $outputFull) {
  throw "输出文件已存在：$outputFull"
}

$directoryRoots = @(
  '.claude',
  '.vscode',
  'src',
  'backend',
  'scripts',
  'public',
  'data'
)

$files = [System.Collections.Generic.List[System.IO.FileInfo]]::new()

foreach ($file in (Get-ChildItem -LiteralPath $projectRoot -File)) {
  if ($file.Extension -ne '.zip') {
    $files.Add($file)
  }
}

foreach ($relativePath in $directoryRoots) {
  $fullPath = Join-Path $projectRoot $relativePath
  if (-not (Test-Path -LiteralPath $fullPath -PathType Container)) {
    continue
  }

  foreach ($file in (Get-ChildItem -LiteralPath $fullPath -File -Recurse)) {
    $normalized = $file.FullName.Replace('\', '/')
    if ($normalized -notmatch '/node_modules/' -and $normalized -notmatch '/\.git/') {
      $files.Add($file)
    }
  }
}

$files = @($files | Sort-Object FullName -Unique)
$outputStream = [System.IO.File]::Open(
  $outputFull,
  [System.IO.FileMode]::CreateNew,
  [System.IO.FileAccess]::Write,
  [System.IO.FileShare]::None
)

try {
  $archive = [System.IO.Compression.ZipArchive]::new(
    $outputStream,
    [System.IO.Compression.ZipArchiveMode]::Create,
    $false,
    [System.Text.Encoding]::UTF8
  )
  try {
    foreach ($file in $files) {
      $entryName = [System.IO.Path]::GetRelativePath($projectRoot, $file.FullName).Replace('\', '/')
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $archive,
        $file.FullName,
        $entryName,
        [System.IO.Compression.CompressionLevel]::Optimal
      ) | Out-Null
    }
  } finally {
    $archive.Dispose()
  }
} finally {
  $outputStream.Dispose()
}

$sourceBytes = ($files | Measure-Object Length -Sum).Sum
[pscustomobject]@{
  OutputPath = $outputFull
  FileCount = $files.Count
  SourceMB = [math]::Round($sourceBytes / 1MB, 1)
  ZipMB = [math]::Round((Get-Item -LiteralPath $outputFull).Length / 1MB, 1)
}
