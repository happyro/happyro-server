#include "game_control_navigation.hpp"

#include "happyro_navigation.hpp"
#include "pc.hpp"
#include "npc.hpp"
#include "packets.hpp"
#include <common/socket.hpp>
#include <common/strlib.hpp>

GameControlNavigationResult game_control_teleport(map_session_data* sd, const nlohmann::json& payload) {
	auto invalid = []() -> GameControlNavigationResult {
		return {400, {{"error", {{"code", "invalid_parameter"}}}}};
	};
	if (!payload.is_object() || !payload.contains("map") || !payload["map"].is_string()
		|| !payload.contains("x") || !payload.contains("y"))
		return invalid();
	for (const auto& [key, value] : payload.items()) {
		if (key == "map") continue;
		if ((key != "x" && key != "y" && key != "npc_class") || !value.is_number_integer()
			|| value < (key == "npc_class" ? 1 : 0) || value > 32767)
			return invalid();
	}
	const auto map = payload["map"].get<std::string>();
	if (map.empty() || map.size() >= MAP_NAME_LENGTH_EXT || map.find('\0') != std::string::npos)
		return invalid();
	const uint16 x = payload["x"].get<uint16>();
	const uint16 y = payload["y"].get<uint16>();
	const bool npc = payload.contains("npc_class");
	const auto outcome = npc ? happyro_npc_teleport(sd, map.c_str(), x, y, payload["npc_class"].get<int32>())
		: happyro_map_teleport(sd, map.c_str(), x, y);
	if (outcome.code != 0) {
		static const char* npc_errors[] = {"", "navigation_disabled", "navigation_cross_map_disabled", "navigation_cooldown",
			"navigation_invalid_map", "navigation_npc_unavailable", "navigation_map_forbidden", "navigation_no_cell", "navigation_failed"};
		static const char* map_errors[] = {"", "navigation_disabled", "navigation_cross_map_disabled", "navigation_cooldown",
			"navigation_invalid_map", "navigation_map_forbidden", "navigation_invalid_coordinate", "navigation_failed"};
		return {409, {{"error", {{"code", npc ? npc_errors[outcome.code] : map_errors[outcome.code]}, {"cooldown_remaining", outcome.cooldown}}}}};
	}
	return {200, {{"data", {{"result", {{"char_id", sd->status.char_id}, {"map", outcome.map},
		{"x", outcome.x}, {"y", outcome.y}, {"cooldown_remaining", outcome.cooldown}}}}}}};
}

GameControlNavigationResult game_control_route(map_session_data* sd, const nlohmann::json& payload) {
	const auto error = [](const char* code, int status = 400) -> GameControlNavigationResult {
		return {status, {{"error", {{"code", code}}}}};
	};
	if (!payload.is_object() || !payload.contains("action") || !payload["action"].is_string())
		return error("invalid_parameter");
	const auto action = payload["action"].get<std::string>();
	if (action != "stop" && action != "walk" && action != "preview") return error("invalid_parameter");
	for (const auto& [key, value] : payload.items()) {
		if (key == "action") continue;
		if (action == "stop") return error("invalid_parameter");
		if (key == "map") {
			if (!value.is_string()) return error("invalid_parameter");
		} else if ((key != "x" && key != "y" && key != "npc_class") || !value.is_number_integer()
			|| value < (key == "npc_class" ? 1 : 0) || value > 32767) return error("invalid_parameter");
	}
	PACKET_ZC_HAPPYRO_NAVIGATION_CONTROL packet{};
	packet.packetType = HEADER_ZC_HAPPYRO_NAVIGATION_CONTROL;
	packet.action = action == "stop" ? 0 : action == "walk" ? 1 : 2;
	if (action != "stop") {
		if (!payload.contains("map") || !payload.contains("x") || !payload.contains("y")) return error("invalid_parameter");
		const auto map = payload["map"].get<std::string>();
		if (map.empty() || map.size() >= MAP_NAME_LENGTH_EXT || map.find('\0') != std::string::npos) return error("invalid_parameter");
		if (mapindex_name2idx(map.c_str(), nullptr) != sd->mapindex) return error("navigation_same_map_required", 409);
		int16 x = payload["x"].get<int16>(), y = payload["y"].get<int16>();
		if (payload.contains("npc_class")) {
			const auto* npc = happyro_navigation_npc(sd, map.c_str(), x, y, payload["npc_class"].get<int32>());
			if (!npc) return error("navigation_npc_unavailable", 409);
			if (!happyro_npc_adjacent_cell(*npc, x, y)) return error("navigation_no_cell", 409);
		}
		const auto* mapdata = map_getmapdata(sd->m);
		if (!mapdata || x >= mapdata->xs || y >= mapdata->ys || map_getcell(sd->m, x, y, CELL_CHKNOPASS))
			return error("navigation_invalid_coordinate", 409);
		safestrncpy(packet.map, map.c_str(), sizeof(packet.map));
		packet.x = x;
		packet.y = y;
	}
	WFIFOHEAD(sd->fd, sizeof(packet));
	memcpy(WFIFOP(sd->fd, 0), &packet, sizeof(packet));
	WFIFOSET(sd->fd, sizeof(packet));
	return {200, {{"data", {{"result", {{"char_id", sd->status.char_id}, {"dispatched", true}, {"action", action}}}}}}};
}
