@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat" x64
cl /EHsc /std:c++17 /Fe:"%~dp0installer.exe" "%~dp0installer.cpp" /link shell32.lib ole32.lib
if %ERRORLEVEL% NEQ 0 (
    echo BUILD FAILED
    exit /b 1
)
echo BUILD SUCCESS
