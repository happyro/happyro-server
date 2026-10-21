#ifndef HAPPYRO_GAME_CONTROL_ENVELOPE_HPP
#define HAPPYRO_GAME_CONTROL_ENVELOPE_HPP

#include <string>
#include <nlohmann/json.hpp>

inline bool has_valid_command_envelope(const nlohmann::json& body) {
	if (!body.is_object() || !body.contains("id") || !body.contains("type") || !body.contains("payload"))
		return false;
	for (const auto* field : {"id", "type"}) {
		if (!body[field].is_string())
			return false;
		const auto& value = body[field].get_ref<const std::string&>();
		if (value.empty() || value.size() > 64 || value.find('\0') != std::string::npos)
			return false;
	}
	return body["payload"].is_object();
}

#endif
