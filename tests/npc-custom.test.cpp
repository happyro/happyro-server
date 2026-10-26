#include "../src/map/npc_custom.hpp"
#include <cassert>
#include <iostream>
using namespace happyro_custom;
void write(const fs::path& path, const std::string& data) {
    fs::create_directories(path.parent_path()); std::ofstream(path) << data;
}
int main(int argc, char** argv) {
    bool plain = false;
    std::vector<std::string> arguments;
    for (int i = 1; i < argc; ++i) {
        if (std::string(argv[i]) == "--no-color") plain = true;
        else arguments.emplace_back(argv[i]);
    }
    if (arguments.empty() || arguments[0] == "--help") {
        auto style = [plain](const std::string& code, const std::string& text) {
            return plain ? text : "\033[" + code + "m" + text + "\033[0m";
        };
        std::cout << "\n" << style("1;36", "HappyRO custom NPC test") << "\n\n"
            << style("1;33", "Usage") << "\n"
            << style("1;32", "  npc-custom-test <empty-fixture-directory> [--no-color]") << "\n\n"
            << style("1;33", "Example") << "\n"
            << style("36", "  npc-custom-test /tmp/custom-npc-fixture --no-color") << "\n\n";
        return 0;
    }
    assert(arguments.size() == 1);
    fs::current_path(arguments[0]);
    auto custom = fs::current_path() / "custom";
    setenv("HAPPYRO_SERVER_CUSTOM_NPC_DIR", custom.c_str(), 1);
    write("npc/custom/test.txt", "builtin");
    assert(source("npc/custom/test.txt") == "npc/custom/test.txt");
    write(custom / "overrides/custom/test.txt", "user");
    assert(source("npc/custom/test.txt") == (custom / "overrides/custom/test.txt").string());
    assert(source("./npc/custom/test.txt") == (custom / "overrides/custom/test.txt").string());
    assert(source(fs::absolute("npc/custom/test.txt").string()) == (custom / "overrides/custom/test.txt").string());
    write(custom / "overrides/re/scripts_main.conf", "invalid");
    assert(source("npc/re/scripts_main.conf") == "npc/re/scripts_main.conf");
    fs::remove(custom / "overrides/custom/test.txt");
    assert(source("npc/custom/test.txt") == "npc/custom/test.txt");
    write(custom / "scripts.conf", "npc: additions/test.txt\nimport: additions/events.conf\n");
    write(custom / "additions/test.txt", "// custom NPC");
    write(custom / "additions/events.conf", "npc: additions/test.txt\n");
    assert(additions().size() == 1);
    write(custom / "additions/events.conf", "import: additions/events.conf\n");
    bool failed = false; try { additions(); } catch (...) { failed = true; } assert(failed);
    write(custom / "scripts.conf", "npc: additions/../../secret.txt\n");
    failed = false; try { additions(); } catch (...) { failed = true; } assert(failed);
    fs::create_symlink(fs::absolute("npc/custom/test.txt"), custom / "overrides/custom/test.txt");
    failed = false; try { source("npc/custom/test.txt"); } catch (...) { failed = true; } assert(failed);
    unsetenv("HAPPYRO_SERVER_CUSTOM_NPC_DIR");
    assert(additions().empty());
    assert(source("npc/custom/test.txt") == "npc/custom/test.txt");
    std::cout << "NPC override/addition resolution passed\n";
}
