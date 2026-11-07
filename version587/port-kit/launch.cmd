@echo off
setlocal DisableDelayedExpansion
set "FOXMAIL_PATCH_SELF=%~f0"
set "FOXMAIL_PATCH_MODE=apply"
if not "%~2"=="" goto usage
if "%~1"=="" goto ready
if /i "%~1"=="apply" goto ready
if /i "%~1"=="check" (
    set "FOXMAIL_PATCH_MODE=check"
    goto ready
)
if /i "%~1"=="trial" (
    set "FOXMAIL_PATCH_MODE=trial"
    goto ready
)
goto usage

:ready
if not exist "%~dp0Foxmail.exe" (
    echo Put this CMD next to Foxmail.exe and run it again.
    set "foxmail_patch_status=2"
    goto finish
)
set "foxmail_patch_pwsh=%ProgramFiles%\PowerShell\7\pwsh.exe"
if exist "%foxmail_patch_pwsh%" goto run
set "foxmail_patch_pwsh="
for %%I in (pwsh.exe) do set "foxmail_patch_pwsh=%%~$PATH:I"
if not defined foxmail_patch_pwsh goto no_pwsh
for %%I in ("%foxmail_patch_pwsh%") do if /i "%%~dpI"=="%~dp0" goto no_pwsh

:run
"%foxmail_patch_pwsh%" -NoLogo -NoProfile -Command "__FOXMAIL_BOOTSTRAP__"
set "foxmail_patch_status=%errorlevel%"
goto finish

:no_pwsh
echo PowerShell 7 is required. Install it or add pwsh.exe to PATH.
set "foxmail_patch_status=2"
goto finish

:usage
echo Usage: "%~nx0" [apply^|check^|trial]
set "foxmail_patch_status=2"

:finish
if "%~1"=="" pause
exit /b %foxmail_patch_status%

:__FOXMAIL_PAYLOAD__
__FOXMAIL_ARCHIVE__
