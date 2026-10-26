// HappyRO: user-owned scripts without replacing the versioned NPC tree.
#ifndef HAPPYRO_NPC_CUSTOM_HPP
#define HAPPYRO_NPC_CUSTOM_HPP

#include <algorithm>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <set>
#include <stdexcept>
#include <string>
#include <vector>

namespace happyro_custom {
namespace fs = std::filesystem;

inline fs::path root() {
	const char* value = std::getenv("HAPPYRO_SERVER_CUSTOM_NPC_DIR");
	return value && *value ? fs::absolute(value).lexically_normal() : fs::path();
}

inline fs::path contained(const fs::path& base, const fs::path& relative) {
	if (relative.is_absolute() || relative.empty()) throw std::runtime_error("Expected a relative custom NPC path");
	for (const auto& part : relative)
		if (part == "..") throw std::runtime_error("Parent paths are not allowed in custom NPC paths");
	const auto target = base / relative;
	auto cursor = base;
	if (fs::is_symlink(cursor)) throw std::runtime_error("Custom NPC symlinks are not supported");
	for (const auto& part : relative) {
		cursor /= part;
		if (fs::is_symlink(cursor)) throw std::runtime_error("Custom NPC symlinks are not supported");
	}
	return target.lexically_normal();
}

// Keep the logical filename for unload/reload identity; only redirect file reads.
inline std::string source(const std::string& logical) {
	const auto custom = root();
	if (custom.empty()) return logical;
	const auto relative = fs::absolute(logical).lexically_normal().lexically_relative(fs::current_path() / "npc");
	if (relative.empty() || relative.extension() != ".txt") return logical;
	for (const auto& part : relative) if (part == "..") return logical;
	const auto candidate = contained(custom / "overrides", relative);
	if (fs::exists(candidate)) {
		if (!fs::is_regular_file(candidate)) throw std::runtime_error("NPC override is not a regular file: " + candidate.string());
		return candidate.string();
	}
	return logical;
}

inline std::string trim(const std::string& value) {
	const auto first = value.find_first_not_of(" \t\r\n");
	return first == std::string::npos ? "" : value.substr(first, value.find_last_not_of(" \t\r\n") - first + 1);
}

inline void manifest(const fs::path& custom, const fs::path& file, std::set<std::string>& active,
	std::set<std::string>& loaded, std::vector<std::string>& scripts) {
	const auto key = file.lexically_normal().string();
	if (active.count(key)) throw std::runtime_error("Circular custom NPC import: " + key);
	if (loaded.count(key)) return;
	std::ifstream input(file);
	if (!input) throw std::runtime_error("Cannot read custom NPC manifest: " + key);
	active.insert(key);
	std::string line;
	while (std::getline(input, line)) {
		line = trim(line.substr(0, line.find("//")));
		if (line.empty()) continue;
		const auto colon = line.find(':');
		if (colon == std::string::npos) throw std::runtime_error("Invalid custom NPC directive: " + line);
		const auto directive = trim(line.substr(0, colon));
		const fs::path relative(trim(line.substr(colon + 1)));
		if (relative.begin() == relative.end() || *relative.begin() != "additions")
			throw std::runtime_error("Custom NPC manifests may only load additions/ paths");
		const auto target = contained(custom, relative);
		if (directive == "import" && target.extension() == ".conf") manifest(custom, target, active, loaded, scripts);
		else if (directive == "npc" && target.extension() == ".txt" && fs::is_regular_file(target)) {
			if (std::find(scripts.begin(), scripts.end(), target.string()) == scripts.end()) scripts.push_back(target.string());
		} else throw std::runtime_error("Invalid or missing custom NPC source: " + line);
	}
	active.erase(key);
	loaded.insert(key);
}

inline std::vector<std::string> additions() {
	const auto custom = root();
	std::vector<std::string> scripts;
	if (custom.empty()) return scripts;
	std::set<std::string> active, loaded;
	manifest(custom, contained(custom, "scripts.conf"), active, loaded, scripts);
	return scripts;
}
}
#endif
