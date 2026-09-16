param(
  [string]$OutputPath = "隧洞数字孪生平台_TEM模块交付包_20260910_UTF8.zip"
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

$rootFiles = @(
  '.gitignore',
  'index.html',
  'package.json',
  'package-lock.json',
  'README.md',
  'TEM模块交付说明.md',
  '交接说明_超前地质预报模块.md',
  '综合物探体素建模模块说明.md',
  '体数据建模与渲染技术文档.md',
  '子模块接入文档.md',
  '隧洞围岩设计分级功能文档.md',
  'tsconfig.app.json',
  'tsconfig.json',
  'tsconfig.node.json',
  'vite.config.ts'
)

$directoryRoots = @(
  'src',
  'scripts',
  'backend/src',
  'backend/scripts',
  'public/config',
  'public/images',
  'public/data/tem_output',
  'dist/assets',
  'dist/cesium',
  'dist/config',
  'dist/images',
  'dist/data/tem_output'
)

$extraFiles = @(
  'backend/.env.example',
  'backend/package.json',
  'backend/package-lock.json',
  'public/vite.svg',
  'dist/index.html',
  'dist/vite.svg'
)

$files = [System.Collections.Generic.List[System.IO.FileInfo]]::new()
foreach ($relativePath in ($rootFiles + $extraFiles)) {
  $fullPath = Join-Path $projectRoot $relativePath
  if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
    $files.Add((Get-Item -LiteralPath $fullPath))
  }
}

foreach ($relativePath in $directoryRoots) {
  $fullPath = Join-Path $projectRoot $relativePath
  if (Test-Path -LiteralPath $fullPath -PathType Container) {
    foreach ($file in (Get-ChildItem -LiteralPath $fullPath -File -Recurse)) {
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
