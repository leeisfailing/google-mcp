@echo off
REM Build installer with MSVC — static CRT, no false positives
REM Requires: Visual Studio Build Tools (cl.exe in PATH)

where cl >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: cl.exe not found. Run from Developer Command Prompt, or:
    echo   "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat" x64
    exit /b 1
)

echo Building installer...
cl /std:c++17 /EHsc /utf-8 /MT /O2 ^
   /DUNICODE /D_UNICODE ^
   installer.cpp ^
   /link user32.lib shell32.lib advapi32.lib shlwapi.lib ^
   /SUBSYSTEM:CONSOLE ^
   /MANIFEST:EMBED ^
   /MANIFESTINPUT:installer.manifest ^
   /OUT:installer.exe

if %errorlevel% equ 0 (
    echo Build successful: installer.exe
    del installer.obj >nul 2>&1
) else (
    echo Build failed.
)
