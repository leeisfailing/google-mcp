@echo off
REM Build installer with MSVC
REM Run this from Developer Command Prompt, or just double-click it

set "VCVARS=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat"

if exist "%VCVARS%" (
    call "%VCVARS%" x64 >nul 2>&1
) else (
    echo ERROR: MSVC Build Tools not found.
    echo Install from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
    exit /b 1
)

echo Building installer...
cl /std:c++17 /EHsc /utf-8 /MT /O2 /DUNICODE /D_UNICODE ^
   installer.cpp ^
   /link user32.lib shell32.lib advapi32.lib shlwapi.lib comdlg32.lib ^
   /SUBSYSTEM:CONSOLE ^
   /MANIFEST:EMBED ^
   /MANIFESTINPUT:installer.manifest ^
   /OUT:installer.exe

if %errorlevel% equ 0 (
    echo.
    echo Build successful: installer.exe
    del installer.obj >nul 2>&1
) else (
    echo.
    echo Build failed.
)
pause
