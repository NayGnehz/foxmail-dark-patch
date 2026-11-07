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
set "foxmail_patch_ps=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%foxmail_patch_ps%" goto no_powershell
"%SystemRoot%\System32\more.com" +__FOXMAIL_COMMAND_LINE__ "%FOXMAIL_PATCH_SELF%" | "%foxmail_patch_ps%" -NoLogo -NoProfile -NonInteractive -Command -
set "foxmail_patch_status=%errorlevel%"
goto finish

:no_powershell
echo Windows PowerShell 5.1 is required.
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
:__FOXMAIL_POWERSHELL__
__FOXMAIL_COMMAND__
