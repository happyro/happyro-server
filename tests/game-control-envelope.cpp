#include "../src/common/game_control_envelope.hpp"
#include <cassert>

int main() {
	using nlohmann::json;
	const json valid = {{"id", "command-id"}, {"type", "battle_config.apply"}, {"payload", json::object()}};
	assert(has_valid_command_envelope(valid));
	for (const auto& invalid : {json(), json::array(), json(42), json("request")})
		assert(!has_valid_command_envelope(invalid));
	for (const auto* field : {"id", "type", "payload"}) {
		auto request = valid;
		request.erase(field);
		assert(!has_valid_command_envelope(request));
		for (const auto& invalid : {json(), json(42), json(false), json::array()}) {
			request = valid;
			request[field] = invalid;
			assert(!has_valid_command_envelope(request));
		}
	}
	for (const auto* field : {"id", "type"}) {
		for (const auto& invalid : {std::string(), std::string(65, 'a'), std::string("a\0b", 3)}) {
			auto request = valid;
			request[field] = invalid;
			assert(!has_valid_command_envelope(request));
		}
		auto request = valid;
		request[field] = std::string(64, 'a');
		assert(has_valid_command_envelope(request));
	}
	for (const auto* type : {"capabilities", "battle_config.read", "character.snapshot"}) {
		auto request = valid;
		request["type"] = type;
		assert(has_valid_command_envelope(request));
	}
}
