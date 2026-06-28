#include <windows.h>
#include <shellapi.h>
#include <string>
#include <fstream>
#include <sstream>
#include <iostream>
#include <filesystem>
#include <algorithm>

namespace fs = std::filesystem;

// ─── Helpers ───────────────────────────────────────────────────────────────────

static std::string ReadFile(const fs::path& path)
{
    std::ifstream f(path);
    if (!f.is_open()) return "";
    std::stringstream ss;
    ss << f.rdbuf();
    return ss.str();
}

static bool WriteFile(const fs::path& path, const std::string& content)
{
    std::ofstream f(path, std::ios::trunc);
    if (!f.is_open()) return false;
    f << content;
    return true;
}

static std::string Trim(const std::string& s)
{
    size_t start = s.find_first_not_of(" \t\r\n");
    size_t end   = s.find_last_not_of(" \t\r\n");
    return (start == std::string::npos) ? "" : s.substr(start, end - start + 1);
}

static std::string RunCommand(const std::string& cmd)
{
    std::string result;
    FILE* pipe = _popen(cmd.c_str(), "r");
    if (!pipe) return result;
    char buf[256];
    while (fgets(buf, sizeof(buf), pipe))
        result += buf;
    _pclose(pipe);
    return Trim(result);
}

static int RunCommandInteractive(const std::string& cmd)
{
    return system(cmd.c_str());
}

static std::string FindInPath(const std::string& exe)
{
    std::string out = RunCommand("where " + exe + " 2>nul");
    if (out.empty()) return "";
    size_t nl = out.find('\n');
    return (nl != std::string::npos) ? Trim(out.substr(0, nl)) : out;
}

// ─── Console Colors ────────────────────────────────────────────────────────────

static void Color(WORD color)
{
    SetConsoleTextAttribute(GetStdHandle(STD_OUTPUT_HANDLE), color);
}
static void Green()   { Color(FOREGROUND_GREEN | FOREGROUND_INTENSITY); }
static void Red()     { Color(FOREGROUND_RED | FOREGROUND_INTENSITY); }
static void Cyan()    { Color(FOREGROUND_GREEN | FOREGROUND_BLUE | FOREGROUND_INTENSITY); }
static void Yellow()  { Color(FOREGROUND_RED | FOREGROUND_GREEN | FOREGROUND_INTENSITY); }
static void Reset()   { Color(FOREGROUND_RED | FOREGROUND_GREEN | FOREGROUND_BLUE); }

// ─── Locate Claude Desktop config ──────────────────────────────────────────────

static fs::path FindClaudeConfig()
{
    const char* appData = getenv("APPDATA");
    if (!appData) return "";

    // Microsoft Store path
    fs::path msStore = fs::path(appData) / ".." / "Local" / "Packages" /
                       "Claude_pzs8sxrjxfjjc" / "LocalCache" / "Roaming" / "Claude" /
                       "claude_desktop_config.json";
    msStore = fs::weakly_canonical(msStore);
    if (fs::exists(msStore)) return msStore;

    fs::path appDataPath = fs::path(appData) / "Claude" / "claude_desktop_config.json";
    if (fs::exists(appDataPath)) return appDataPath;

    return appDataPath;
}

// ─── JSON helpers ──────────────────────────────────────────────────────────────

static size_t FindMatchingBrace(const std::string& json, size_t start)
{
    int depth = 0;
    for (size_t i = start; i < json.size(); ++i) {
        if (json[i] == '{')      ++depth;
        else if (json[i] == '}') { if (--depth == 0) return i; }
    }
    return std::string::npos;
}

static std::string BuildMcpEntry(const std::string& buildJs)
{
    std::string winPath;
    for (char c : buildJs) {
        if (c == '/') winPath += "\\\\";
        else          winPath += c;
    }
    std::ostringstream ss;
    ss << "      \"google-mcp\": {\n"
       << "        \"command\": \"node\",\n"
       << "        \"args\": [\"" << winPath << "\"]\n"
       << "      }";
    return ss.str();
}

static std::string PatchConfig(const std::string& json, const std::string& buildJs)
{
    std::string entry = BuildMcpEntry(buildJs);
    std::string result = json;

    size_t keyPos = result.find("\"google-mcp\"");
    if (keyPos != std::string::npos) {
        size_t colonPos = result.find(':', keyPos);
        if (colonPos == std::string::npos) return result;
        size_t openBrace = result.find('{', colonPos);
        if (openBrace == std::string::npos) return result;
        size_t closeBrace = FindMatchingBrace(result, openBrace);
        if (closeBrace == std::string::npos) return result;
        size_t end = closeBrace + 1;
        if (end < result.size() && result[end] == ',') ++end;
        size_t start = keyPos;
        if (start > 0 && result[start - 1] == ',') --start;
        result.replace(start, end - start, entry);
        return result;
    }

    size_t serversPos = result.find("\"mcpServers\"");
    if (serversPos != std::string::npos) {
        size_t openBrace = result.find('{', serversPos);
        if (openBrace != std::string::npos) {
            size_t closeBrace = FindMatchingBrace(result, openBrace);
            if (closeBrace != std::string::npos) {
                std::string between = Trim(result.substr(openBrace + 1,
                                                          closeBrace - openBrace - 1));
                if (between.empty()) {
                    result.insert(openBrace + 1, "\n" + entry + "\n    ");
                } else {
                    result.insert(closeBrace, ",\n" + entry + "\n    ");
                }
                return result;
            }
        }
    }

    return "{\n  \"mcpServers\": {\n" + entry + "\n  }\n}\n";
}

// ─── Setup Steps ───────────────────────────────────────────────────────────────

struct StepResult { bool ok; std::string msg; };

static StepResult Step_CheckNodeJs()
{
    std::string nodePath = FindInPath("node");
    if (nodePath.empty())
        return { false, "Node.js is NOT installed.\n\n"
                        "  Install from: https://nodejs.org/\n"
                        "  Choose LTS, then restart your terminal." };
    std::string ver = RunCommand("node --version 2>nul");
    return { true, "Node.js " + ver };
}

static bool CopySkillDir(const fs::path& srcDir, const fs::path& destDir, std::string& err)
{
    std::error_code ec;
    fs::create_directories(destDir, ec);
    if (ec) { err = "Failed to create " + destDir.string() + ": " + ec.message(); return false; }

    for (const auto& entry : fs::directory_iterator(srcDir)) {
        if (entry.is_regular_file()) {
            fs::copy_file(entry.path(), destDir / entry.path().filename(),
                          fs::copy_options::overwrite_existing, ec);
            if (ec) { err = "Failed to copy " + entry.path().string() + ": " + ec.message(); return false; }
        }
    }
    return true;
}

static StepResult Step_InstallSkills(const fs::path& projectRoot)
{
    const char* userProfile = getenv("USERPROFILE");
    if (!userProfile)
        return { false, "Could not find user profile directory." };

    fs::path openClaudeSkills = fs::path(userProfile) / ".openclaude" / "skills";
    std::error_code ec;
    fs::create_directories(openClaudeSkills, ec);
    if (ec)
        return { false, "Failed to create skills directory: " + ec.message() };

    int installed = 0;
    std::string lastSkill;
    std::string err;

    // 1. Install google-mcp skill from skills/google-mcp/
    fs::path gmSrc = projectRoot / "skills" / "google-mcp";
    if (fs::exists(gmSrc) && fs::is_directory(gmSrc)) {
        fs::path gmDest = openClaudeSkills / "google-mcp";
        if (!CopySkillDir(gmSrc, gmDest, err))
            return { false, "Failed to install google-mcp skill: " + err };
        installed++;
        lastSkill = "google-mcp";
    }

    // 2. Install skills from Skills/ directory (zip files: extract SKILL.md)
    fs::path skillsDir = projectRoot / "Skills";
    if (fs::exists(skillsDir) && fs::is_directory(skillsDir)) {
        for (const auto& entry : fs::directory_iterator(skillsDir)) {
            std::string fname = entry.path().filename().string();

            if (entry.is_regular_file() && fname.size() > 4 &&
                fname.substr(fname.size() - 4) == ".zip")
            {
                // Extract zip to temp, find SKILL.md, copy to skills dir
                std::string skillName = fname.substr(0, fname.size() - 4);
                // Strip trailing "-main" if present (humanizer-main → humanizer)
                if (skillName.size() > 5 && skillName.substr(skillName.size() - 5) == "-main")
                    skillName = skillName.substr(0, skillName.size() - 5);

                fs::path tempDir = fs::temp_directory_path() / ("skill_extract_" + skillName);
                // Clean up temp dir first
                fs::remove_all(tempDir, ec);

                // Create temp dir first
                fs::create_directories(tempDir, ec);

                // Try tar (Windows 10+), fall back to PowerShell Expand-Archive
                std::string cmd = "tar -xf \"" + entry.path().string() +
                                  "\" -C \"" + tempDir.string() + "\" 2>nul";
                std::string out = RunCommand(cmd);

                // If tar failed or not available, use PowerShell
                if (out.empty() && !fs::exists(tempDir / "SKILL.md")) {
                    // Check if any file was extracted
                    bool found = false;
                    for (const auto& de : fs::directory_iterator(tempDir)) {
                        found = true; break;
                    }
                    if (!found) {
                        cmd = "powershell -NoProfile -Command \"Expand-Archive -Path '" +
                              entry.path().string() + "' -DestinationPath '" +
                              tempDir.string() + "' -Force\"";
                        RunCommand(cmd);
                    }
                }

                // Find SKILL.md in extracted content
                fs::path skillMd;
                for (const auto& root_entry : fs::recursive_directory_iterator(tempDir)) {
                    if (root_entry.is_regular_file() &&
                        root_entry.path().filename() == "SKILL.md") {
                        skillMd = root_entry.path();
                        break;
                    }
                }

                if (!skillMd.empty()) {
                    fs::path skillDest = openClaudeSkills / skillName;
                    fs::create_directories(skillDest, ec);
                    fs::copy_file(skillMd, skillDest / "SKILL.md",
                                  fs::copy_options::overwrite_existing, ec);
                    if (!ec) {
                        installed++;
                        lastSkill = skillName;
                    }
                }

                // Clean up temp
                fs::remove_all(tempDir, ec);
            }
            else if (entry.is_directory()) {
                // Direct skill directory (e.g., Skills/some-skill/SKILL.md)
                std::string skillName = fname;
                fs::path skillMdSrc = entry.path() / "SKILL.md";
                if (fs::exists(skillMdSrc)) {
                    fs::path skillDest = openClaudeSkills / skillName;
                    fs::create_directories(skillDest, ec);
                    fs::copy_file(skillMdSrc, skillDest / "SKILL.md",
                                  fs::copy_options::overwrite_existing, ec);
                    if (!ec) {
                        installed++;
                        lastSkill = skillName;
                    }
                }
            }
        }
    }

    if (installed == 0)
        return { false, "No skills found to install.\n"
                        "  Expected: skills/google-mcp/SKILL.md\n"
                        "  And/or: Skills/*.zip with SKILL.md inside" };

    return { true, std::to_string(installed) + " skill(s) installed to:\n  " +
                   openClaudeSkills.string() + "\n" +
                   "  Last: " + lastSkill };
}

static StepResult Step_CheckClaudeDesktop()
{
    fs::path configPath = FindClaudeConfig();
    if (configPath.empty() || !fs::exists(configPath)) {
        const char* la = getenv("LOCALAPPDATA");
        if (la) {
            if (fs::exists(fs::path(la) / "Packages" / "Claude_pzs8sxrjxfjjc") ||
                fs::exists("C:/Program Files/Claude"))
                return { true, "Claude Desktop found (first-time config will be created)." };
        }
        return { false, "Claude Desktop is NOT installed.\n\n"
                        "  Install from: https://claude.ai/download" };
    }
    return { true, "Claude Desktop found" };
}

static StepResult Step_NpmInstall(const fs::path& projectRoot)
{
    fs::path nodeModules = projectRoot / "node_modules";
    if (fs::exists(nodeModules) && !fs::is_empty(nodeModules)) {
        // Check if package.json is newer than node_modules
        auto pmTime = fs::last_write_time(projectRoot / "package.json");
        auto nmTime = fs::last_write_time(nodeModules);
        if (nmTime >= pmTime)
            return { true, "node_modules already up to date" };
    }

    std::cout << "\n  Running: npm install\n";
    std::string cmd = "cd /d \"" + projectRoot.string() + "\" && npm install";
    int rc = RunCommandInteractive(cmd);
    if (rc != 0)
        return { false, "npm install failed (exit code " + std::to_string(rc) + ")\n\n"
                        "  Make sure Node.js is installed and try again." };
    return { true, "npm install completed" };
}

static StepResult Step_NpmBuild(const fs::path& projectRoot)
{
    fs::path buildJs = projectRoot / "build" / "index.js";
    if (fs::exists(buildJs)) {
        auto srcTime = fs::last_write_time(projectRoot / "src" / "index.ts");
        auto bldTime = fs::last_write_time(buildJs);
        if (bldTime >= srcTime)
            return { true, "build already up to date" };
    }

    std::cout << "\n  Running: npm run build\n";
    std::string cmd = "cd /d \"" + projectRoot.string() + "\" && npm run build";
    int rc = RunCommandInteractive(cmd);
    if (rc != 0)
        return { false, "npm run build failed (exit code " + std::to_string(rc) + ")\n\n"
                        "  Check the error output above." };
    return { true, "Build completed" };
}

static StepResult Step_CheckKeyJson(const fs::path& projectRoot)
{
    fs::path keyPath = projectRoot / "key.json";
    if (!fs::exists(keyPath))
        return { false, "key.json not found" };

    std::string content = ReadFile(keyPath);
    if (content.find("client_id") == std::string::npos &&
        content.find("installed") == std::string::npos &&
        content.find("web") == std::string::npos)
        return { false, "key.json doesn't look like a valid Google API credentials file" };

    return { true, "key.json found and valid" };
}

static StepResult Step_CopyKey(const fs::path& srcKey, const fs::path& destKey)
{
    if (fs::weakly_canonical(srcKey) == fs::weakly_canonical(destKey))
        return { true, "key.json already in project root" };

    std::error_code ec;
    fs::copy_file(srcKey, destKey, fs::copy_options::overwrite_existing, ec);
    if (ec) return { false, "Failed to copy key.json: " + ec.message() };
    return { true, "Copied key.json to project root" };
}

static StepResult Step_OAuth(const fs::path& projectRoot)
{
    fs::path tokenPath = projectRoot / "token.json";
    if (fs::exists(tokenPath))
        return { true, "OAuth token already exists" };

    Yellow();
    std::cout << "\n"
        "  +--------------------------------------------+\n"
        "  |        GOOGLE OAUTH SETUP REQUIRED         |\n"
        "  +--------------------------------------------+\n\n";
    Reset();
    std::cout << "  A browser window will open for Google authorization.\n"
              << "  Follow these steps:\n\n"
              << "  1. Select your Google account\n"
              << "  2. 'Google hasn't verified this app' - Click 'Continue'\n"
              << "  3. '(Your Project) wants access to your Google Account'\n"
              << "     - Check 'Select all' to grant all required permissions\n"
              << "     - Covers: Drive, Calendar, Docs, Sheets, Slides,\n"
              << "       Forms, Classroom, Meet, and Drive Labels\n"
              << "     - Click 'Continue'\n"
              << "  4. You'll see 'Authentication successful'\n\n";

    Cyan();
    std::cout << "  Press Enter when ready to start OAuth...\n";
    Reset();
    std::cin.get();

    std::string cmd = "cd /d \"" + projectRoot.string() + "\" && node build\\index.js";
    RunCommandInteractive(cmd);

    if (fs::exists(tokenPath))
        return { true, "OAuth completed successfully!" };

    return { false, "OAuth did not complete. You can retry by running:\n"
                    "    npm start\n  from the project folder." };
}

static void KillClaudeDesktop()
{
    // Kill all Claude Desktop processes so config can be updated
    RunCommand("taskkill /F /IM Claude.exe 2>nul");
    RunCommand("taskkill /F /IM Claude Desktop.exe 2>nul");
    // Also try the Microsoft Store variant
    RunCommand("taskkill /F /IM claude.exe 2>nul");
    // Small delay to let processes fully exit
    Sleep(1000);
}

static void LaunchClaudeDesktop()
{
    // Try common install locations
    const char* localAppData = getenv("LOCALAPPDATA");
    if (localAppData) {
        // Microsoft Store version
        fs::path msStore = fs::path(localAppData) / "Packages" /
                           "Claude_pzs8sxrjxfjjc" / "LocalCache" / "Local" /
                           "Microsoft" / "WindowsApps" / "Claude.exe";
        if (fs::exists(msStore)) {
            ShellExecuteA(NULL, "open", msStore.string().c_str(), NULL, NULL, SW_SHOWNORMAL);
            return;
        }
        // Standard install
        fs::path standard = fs::path(localAppData) / "Programs" / "Claude" / "Claude.exe";
        if (fs::exists(standard)) {
            ShellExecuteA(NULL, "open", standard.string().c_str(), NULL, NULL, SW_SHOWNORMAL);
            return;
        }
    }
    // Program Files fallback
    fs::path pf = "C:/Program Files/Claude/Claude.exe";
    if (fs::exists(pf)) {
        ShellExecuteA(NULL, "open", pf.string().c_str(), NULL, NULL, SW_SHOWNORMAL);
        return;
    }
    // Last resort: let Windows handle it via Start Menu
    RunCommand("start claude:");
}

static StepResult Step_ConfigureClaude(const fs::path& projectRoot)
{
    fs::path configPath = FindClaudeConfig();
    std::string buildJsPath = (projectRoot / "auto-update.js").string();
    std::replace(buildJsPath.begin(), buildJsPath.end(), '\\', '/');

    if (configPath.empty())
        return { false, "Could not find Claude Desktop config path." };

    fs::create_directories(configPath.parent_path());

    std::string existing = ReadFile(configPath);
    std::string updated = existing.empty()
        ? PatchConfig("{}", buildJsPath)
        : PatchConfig(existing, buildJsPath);

    if (!WriteFile(configPath, updated))
        return { false, "Failed to write config to:\n  " + configPath.string() + "\n\n"
                        "  Try running as Administrator." };

    return { true, "Claude Desktop configured!\n  " + configPath.string() };
}

// ─── Print helpers ─────────────────────────────────────────────────────────────

static void PrintStep(int num, const std::string& label)
{
    Reset();
    std::cout << "  " << num << ". " << label;
}

static void PrintOk(const std::string& msg)
{
    Green();
    std::cout << " [OK]\n";
    Reset();
    std::cout << "     " << msg << "\n";
}

static void PrintFail(const std::string& msg)
{
    Red();
    std::cout << " [FAIL]\n";
    Reset();
    std::cout << "     " << msg << "\n";
}

static void PrintDone()
{
    Green();
    std::cout << "\n"
        "  ===========================================\n"
        "    INSTALLATION COMPLETE!\n"
        "  ===========================================\n\n";
    Reset();
    std::cout << "  1. Restart Claude Desktop\n"
              << "  2. Start a new conversation\n"
              << "  3. Try: 'Create a spreadsheet with charts and formatting'\n\n"
              << "  You now have 279 tools across 9 Google APIs:\n"
              << "  Drive, Calendar, Docs, Sheets, Slides,\n"
              << "  Forms, Classroom, Meet, and Drive Labels.\n\n";
}

// ─── Main ──────────────────────────────────────────────────────────────────────

int main(int argc, char* argv[])
{
    // Enable ANSI colors
    HANDLE hOut = GetStdHandle(STD_OUTPUT_HANDLE);
    DWORD dwMode = 0;
    GetConsoleMode(hOut, &dwMode);
    dwMode |= ENABLE_VIRTUAL_TERMINAL_PROCESSING;
    SetConsoleMode(hOut, dwMode);

    // Resolve paths relative to the exe
    char exeBuf[MAX_PATH] = {};
    GetModuleFileNameA(NULL, exeBuf, MAX_PATH);
    fs::path exeDir = fs::path(exeBuf).parent_path();
    fs::path projectRoot = exeDir.parent_path();

    // If build/index.js is in exeDir, we're at project root already
    if (fs::exists(exeDir / "build" / "index.js"))
        projectRoot = exeDir;
    else if (!fs::exists(projectRoot / "build" / "index.js") &&
             fs::exists(exeDir / "package.json"))
        projectRoot = exeDir;

    SetConsoleTitleA("Google MCP Installer");

    Green();
    std::cout << "\n"
        "  ===========================================\n"
        "    Google MCP - Auto Installer\n"
        "    for Claude Desktop\n"
        "  ===========================================\n\n";
    Reset();

    // ── Step 1: Check Node.js ──────────────────────────────────────────────
    PrintStep(1, "Checking Node.js...");
    auto r = Step_CheckNodeJs();
    if (!r.ok) { PrintFail(r.msg); std::cin.get(); return 1; }
    PrintOk(r.msg);

    // ── Step 2: Check Claude Desktop ───────────────────────────────────────
    PrintStep(2, "Checking Claude Desktop...");
    r = Step_CheckClaudeDesktop();
    if (!r.ok) { PrintFail(r.msg); std::cin.get(); return 1; }
    PrintOk(r.msg);

    // ── Step 3: npm install ────────────────────────────────────────────────
    PrintStep(3, "Installing dependencies (npm install)...");
    r = Step_NpmInstall(projectRoot);
    if (!r.ok) { PrintFail(r.msg); std::cin.get(); return 1; }
    PrintOk(r.msg);

    // ── Step 4: npm run build ──────────────────────────────────────────────
    PrintStep(4, "Building MCP server (npm run build)...");
    r = Step_NpmBuild(projectRoot);
    if (!r.ok) { PrintFail(r.msg); std::cin.get(); return 1; }
    PrintOk(r.msg);

    // ── Step 5: Handle key.json ────────────────────────────────────────────
    fs::path keyPath;
    if (argc >= 2) {
        keyPath = argv[1];
        std::string s = keyPath.string();
        if (s.size() >= 2 && s.front() == '"' && s.back() == '"')
            keyPath = s.substr(1, s.size() - 2);
    } else {
        keyPath = projectRoot / "key.json";
    }

    PrintStep(5, "Checking key.json...");
    r = Step_CheckKeyJson(projectRoot);
    if (!r.ok) {
        PrintFail("key.json not found in project root.\n");
        Reset();
        std::cout << "\n"
            "  +--------------------------------------------+\n"
            "  |          HOW TO GET key.json               |\n"
            "  +--------------------------------------------+\n\n"
            "  1. Go to https://console.cloud.google.com/\n"
            "  2. Create a new project (or select one)\n"
            "  3. Enable these APIs:\n"
            "     - Google Drive API\n"
            "     - Google Calendar API\n"
            "     - Google Docs API\n"
            "     - Google Sheets API\n"
            "     - Google Slides API\n"
            "     - Google Forms API\n"
            "     - Google Classroom API\n"
            "     - Google Meet API\n"
            "     - Google Drive Labels API\n"
            "  4. Go to APIs & Services > Credentials\n"
            "  5. Click '+ Create Credentials' > OAuth client ID\n"
            "  6. Application type: Desktop app\n"
            "  7. Name it (e.g. 'Google MCP')\n"
            "  8. Download the JSON file\n"
            "  9. Rename it to 'key.json'\n"
            "  10. Place it in the project root folder:\n\n"
            "      " << projectRoot.string() << "\n\n"
            "  Then drag key.json onto this installer and run it again.\n"
            "  Or place key.json in the project root and run the installer.\n\n"
            "  Press any key to exit.\n";
        std::cin.get();
        return 1;
    }
    PrintOk(r.msg);

    // Copy if needed
    fs::path destKey = projectRoot / "key.json";
    if (fs::weakly_canonical(keyPath) != fs::weakly_canonical(destKey)) {
        r = Step_CopyKey(keyPath, destKey);
        if (!r.ok) { PrintFail(r.msg); std::cin.get(); return 1; }
        PrintOk(r.msg);
    }

    // ── Step 6: OAuth ──────────────────────────────────────────────────────
    PrintStep(6, "Google OAuth setup...");
    r = Step_OAuth(projectRoot);
    if (!r.ok) { PrintFail(r.msg); std::cin.get(); return 1; }
    PrintOk(r.msg);

    // ── Step 7: Install Claude Skill ──────────────────────────────────────
    PrintStep(7, "Installing skills for Claude...");
    r = Step_InstallSkills(projectRoot);
    if (!r.ok) { PrintFail(r.msg); std::cin.get(); return 1; }
    PrintOk(r.msg);

    // ── Step 8: Configure Claude Desktop ───────────────────────────────────
    // Kill Claude Desktop first so config can be written safely
    Yellow();
    std::cout << "\n  Closing Claude Desktop (if running)...\n";
    Reset();
    KillClaudeDesktop();
    Green();
    std::cout << "  Claude Desktop closed.\n\n";
    Reset();

    PrintStep(8, "Configuring Claude Desktop...");
    r = Step_ConfigureClaude(projectRoot);
    if (!r.ok) { PrintFail(r.msg); std::cin.get(); return 1; }
    PrintOk(r.msg);

    // ── Done ───────────────────────────────────────────────────────────────
    PrintDone();
    Yellow();
    std::cout << "  Launching Claude Desktop...\n\n";
    Reset();
    LaunchClaudeDesktop();
    Green();
    std::cout << "  Claude Desktop is starting. You can close this window.\n\n";
    Reset();
    return 0;
}
