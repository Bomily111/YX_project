# =====================================================
#  隧道爆破孪生 · 调试模块 · 一键启动
#  右键本文件 -> 使用 PowerShell 运行
#  首次运行会自动安装依赖(npm install), 之后就绪自动打开浏览器。
#  关闭本窗口即停止服务。
# =====================================================

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
Set-Location $PSScriptRoot

Write-Host '=============================================='
Write-Host '   隧道爆破孪生 · 调试模块'
Write-Host '=============================================='

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host '未检测到 Node.js / npm, 请先安装: https://nodejs.org' -ForegroundColor Red
  Read-Host '按回车退出'; exit 1
}
if (-not (Test-Path 'node_modules')) {
  Write-Host '首次运行, 正在安装依赖 (npm install), 请稍候(约1-3分钟)...' -ForegroundColor Yellow
  npm install
}

Write-Host ''
Write-Host '正在启动 (就绪后自动打开浏览器)...' -ForegroundColor Cyan
Write-Host '  地址: http://localhost:5173/'
Write-Host '★ 关闭本窗口即停止服务。' -ForegroundColor Green
Write-Host ''

npm run dev

Write-Host ''
Read-Host '服务已停止, 按回车关闭窗口'
