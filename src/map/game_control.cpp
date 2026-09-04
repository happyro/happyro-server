// Copyright (c) rAthena Dev Teams - Licensed under GNU GPL

#include "game_control.hpp"

#include <algorithm>
#include <condition_variable>
#include <cerrno>
#include <cstdio>
#include <cstring>
#include <mutex>
#include <queue>
#include <string>
#include <limits>
#include <initializer_list>
#include <thread>
#include <unordered_set>
#include <vector>

#include <nlohmann/json.hpp>

#include <common/showmsg.hpp>

#include "map.hpp"
#include "battle.hpp"
#include "chrif.hpp"
#include "mob.hpp"
#include "pc.hpp"

#ifndef _WIN32
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/un.h>
#include <unistd.h>
#endif

namespace {
struct Request {
	int fd;
	std::string body;
};

std::mutex queue_mutex;
std::queue<Request> requests;
std::thread listener;
bool stopping = false;
int listener_fd = -1;
std::string socket_path;

std::string response(int status, const nlohmann::json& body) {
	return std::to_string(status) + "\n" + body.dump() + "\n";
}

bool read_character_id(const nlohmann::json& target, int32& char_id) {
	if (!target.is_object() || target.value("type", "") != "character" || !target.contains("id"))
		return false;
	if (target["id"].is_number_integer()) {
		const int64 value = target["id"].get<int64>();
		if (value < 1 || value > std::numeric_limits<int32>::max())
			return false;
		char_id = static_cast<int32>(value);
		return true;
	}
	if (!target["id"].is_string())
		return false;
	const std::string value = target["id"].get<std::string>();
	if (value.empty() || value.find_first_not_of("0123456789") != std::string::npos)
		return false;
	try {
		const long long parsed = std::stoll(value);
		if (parsed < 1 || parsed > std::numeric_limits<int32>::max())
			return false;
		char_id = static_cast<int32>(parsed);
		return true;
	} catch (...) {
		return false;
	}
}

bool payload_has_only_keys(const nlohmann::json& payload, std::initializer_list<const char*> allowed) {
	if (!payload.is_object())
		return false;
	for (const auto& [key, value] : payload.items()) {
		(void)value;
		if (std::find_if(allowed.begin(), allowed.end(), [&](const char* name) { return key == name; }) == allowed.end())
			return false;
	}
	return true;
}

bool read_integer(const nlohmann::json& value, int64 minimum, int64 maximum, int32& result) {
	if (!value.is_number_integer())
		return false;
	try {
		const int64 parsed = value.get<int64>();
		if (parsed < minimum || parsed > maximum)
			return false;
		result = static_cast<int32>(parsed);
		return true;
	} catch (...) {
		return false;
	}
}

void close_request(int fd) {
#ifndef _WIN32
	if (fd >= 0)
		close(fd);
#else
	(void)fd;
#endif
}

void listen_loop() {
#ifdef _WIN32
	return;
#else
	while (true) {
		int fd = accept(listener_fd, nullptr, nullptr);
		if (fd < 0) {
			std::lock_guard lock(queue_mutex);
			if (stopping)
				return;
			continue;
		}

		std::string body;
		char buffer[4096];
		ssize_t count;
		while ((count = recv(fd, buffer, sizeof(buffer), 0)) > 0 && body.size() <= 65536)
			body.append(buffer, static_cast<size_t>(count));
		if (body.size() > 65536) {
			close_request(fd);
			continue;
		}

		std::lock_guard lock(queue_mutex);
		if (stopping) {
			close_request(fd);
			return;
		}
		requests.push({fd, std::move(body)});
	}
#endif
}
}

bool game_control_start(const std::string& path) {
#ifdef _WIN32
	(void)path;
	ShowWarning("Game Control Unix Socket is unavailable on Windows.\n");
	return false;
#else
	if (path.empty() || path.size() >= sizeof(sockaddr_un{}.sun_path))
		return false;

	socket_path = path;
	listener_fd = socket(AF_UNIX, SOCK_STREAM, 0);
	if (listener_fd < 0) {
		socket_path.clear();
		return false;
	}

	sockaddr_un address{};
	address.sun_family = AF_UNIX;
	std::strncpy(address.sun_path, socket_path.c_str(), sizeof(address.sun_path) - 1);
	if (bind(listener_fd, reinterpret_cast<sockaddr*>(&address), sizeof(address)) < 0) {
		const int bind_error = errno;
		close_request(listener_fd);
		listener_fd = -1;
		if (bind_error != EADDRINUSE) {
			socket_path.clear();
			return false;
		}

		const int probe_fd = socket(AF_UNIX, SOCK_STREAM, 0);
		if (probe_fd < 0) {
			socket_path.clear();
			return false;
		}
		if (connect(probe_fd, reinterpret_cast<sockaddr*>(&address), sizeof(address)) == 0) {
			close_request(probe_fd);
			socket_path.clear();
			return false;
		}
		const int connect_error = errno;
		close_request(probe_fd);
		if (connect_error != ECONNREFUSED && connect_error != ENOENT) {
			socket_path.clear();
			return false;
		}

		if (::unlink(socket_path.c_str()) < 0 && errno != ENOENT) {
			socket_path.clear();
			return false;
		}
		listener_fd = socket(AF_UNIX, SOCK_STREAM, 0);
		if (listener_fd < 0 || bind(listener_fd, reinterpret_cast<sockaddr*>(&address), sizeof(address)) < 0) {
			close_request(listener_fd);
			listener_fd = -1;
			socket_path.clear();
			return false;
		}
	}
	if (chmod(socket_path.c_str(), S_IRUSR | S_IWUSR | S_IRGRP | S_IWGRP) < 0
		|| listen(listener_fd, 16) < 0) {
		close_request(listener_fd);
		listener_fd = -1;
		::unlink(socket_path.c_str());
		socket_path.clear();
		return false;
	}

	{
		std::lock_guard lock(queue_mutex);
		stopping = false;
	}
	listener = std::thread(listen_loop);
	return true;
#endif
}

void game_control_stop() {
#ifndef _WIN32
	{
		std::lock_guard lock(queue_mutex);
		stopping = true;
	}
	if (listener_fd >= 0) {
		shutdown(listener_fd, SHUT_RDWR);
		close_request(listener_fd);
		listener_fd = -1;
	}
	if (listener.joinable())
		listener.join();
	while (true) {
		std::lock_guard lock(queue_mutex);
		if (requests.empty())
			break;
		close_request(requests.front().fd);
		requests.pop();
	}
	if (!socket_path.empty())
		::unlink(socket_path.c_str());
#endif
}

void game_control_process() {
	Request request{-1, {}};
	{
		std::lock_guard lock(queue_mutex);
		if (requests.empty())
			return;
		request = std::move(requests.front());
		requests.pop();
	}

	nlohmann::json body;
	try {
		body = nlohmann::json::parse(request.body);
	} catch (...) {
		const std::string output = response(400, {{"error", {{"code", "invalid_json"}}}});
#ifndef _WIN32
		send(request.fd, output.data(), output.size(), 0);
#endif
		close_request(request.fd);
		return;
	}

	int status = 400;
	nlohmann::json result = {{"error", {{"code", "invalid_command"}}}};
	if (!body.is_object() || !body.contains("type") || !body["type"].is_string()
		|| !body.contains("payload") || !body["payload"].is_object()) {
		// Keep the default invalid-command response.
	} else if (const std::string command_type = body["type"].get<std::string>(); command_type == "capabilities") {
		status = 200;
		result = {{"data", {{"protocol_version", "1"}, {"commands", {"character.progression.update", "character.stats.update", "character.stats.reset", "character.skills.reset", "character.vitals.restore", "monster.spawn", "battle_config.apply"}}}}};
	} else if (command_type == "battle_config.read") {
		const char* keys[] = {"base_exp_rate", "job_exp_rate", "item_rate_common", "item_rate_common_boss", "item_rate_common_mvp", "item_rate_card", "item_rate_card_boss", "item_rate_card_mvp"};
		nlohmann::json values = nlohmann::json::object();
		for (const char* key : keys)
			values[key] = battle_get_value(key);
		status = 200;
		result = {{"data", {{"result", {{"values", values}}}}}};
	} else if (command_type == "battle_config.apply") {
		const auto& payload = body["payload"];
		const auto changes = payload.contains("changes") && payload["changes"].is_array()
			? payload["changes"]
			: nlohmann::json::array();
		const std::pair<const char*, int64> allowed[] = {
			{"base_exp_rate", std::numeric_limits<int32>::max()},
			{"job_exp_rate", std::numeric_limits<int32>::max()},
			{"item_rate_common", 1000000},
			{"item_rate_common_boss", 1000000},
			{"item_rate_common_mvp", 1000000},
			{"item_rate_card", 1000000},
			{"item_rate_card_boss", 1000000},
			{"item_rate_card_mvp", 1000000},
		};
		bool valid = payload_has_only_keys(payload, {"changes"}) && !changes.empty();
		std::unordered_set<std::string> keys;
		for (const auto& change : changes) {
			if (!change.is_object() || !payload_has_only_keys(change, {"key", "value"})
				|| !change.contains("key") || !change["key"].is_string() || !change.contains("value")) {
				valid = false;
				break;
			}
			const std::string key = change["key"].get<std::string>();
			const auto definition = std::find_if(std::begin(allowed), std::end(allowed), [&](const auto& item) { return key == item.first; });
			int32 value = 0;
			if (definition == std::end(allowed) || !keys.insert(key).second
				|| !read_integer(change["value"], 0, definition->second, value)) {
				valid = false;
				break;
			}
		}
		if (!valid) {
			status = 400;
			result = {{"error", {{"code", "invalid_parameter"}}}};
		} else {
			nlohmann::json applied = nlohmann::json::array();
			std::vector<std::pair<std::string, int32>> previous_values;
			for (const auto& change : changes) {
				const std::string key = change["key"].get<std::string>();
				const int32 previous = battle_get_value(key.c_str());
				const std::string value = std::to_string(change["value"].get<int64>());
				if (battle_set_value(key.c_str(), value.c_str()) == 0) { valid = false; break; }
				previous_values.emplace_back(key, previous);
				applied.push_back({{"key", key}, {"previous", previous}, {"value", battle_get_value(key.c_str())}});
			}
			if (!valid) {
				for (auto it = previous_values.rbegin(); it != previous_values.rend(); ++it) {
					const std::string previous = std::to_string(it->second);
					battle_set_value(it->first.c_str(), previous.c_str());
				}
				status = 409;
				result = {{"error", {{"code", "configuration_conflict"}}}};
			} else {
				status = 200;
				result = {{"data", {{"result", {{"changes", applied}}}}}};
			}
		}
	} else if (command_type != "character.progression.update"
		&& command_type != "character.stats.update"
		&& command_type != "character.stats.reset"
		&& command_type != "character.skills.reset"
		&& command_type != "character.vitals.restore"
		&& command_type != "monster.spawn") {
		status = 501;
		result = {{"error", {{"code", "unsupported_command"}}}};
	} else if (!body.contains("target")) {
		status = 400;
		result = {{"error", {{"code", "invalid_target"}}}};
	} else {
		int32 char_id = 0;
		if (!read_character_id(body["target"], char_id)) {
			status = 400;
			result = {{"error", {{"code", "invalid_target"}}}};
		} else if (map_session_data* sd = map_charid2sd(char_id); sd == nullptr) {
			status = 409;
			result = {{"error", {{"code", "character_offline"}}}};
		} else if (command_type == "character.progression.update") {
		const auto& payload = body["payload"];
		if (!payload_has_only_keys(payload, {"base_level", "job_level", "job_id"}) || payload.empty()) {
			status = 400;
			result = {{"error", {{"code", "invalid_parameter"}}}};
		} else {
			bool valid = true;
			int32 base_level = 0;
			int32 job_level = 0;
			int32 job_id = 0;
			if (payload.contains("base_level"))
				valid = read_integer(payload["base_level"], 1, std::numeric_limits<int32>::max(), base_level);
			if (valid && payload.contains("job_level"))
				valid = read_integer(payload["job_level"], 1, std::numeric_limits<int32>::max(), job_level);
			if (valid && payload.contains("job_id"))
				valid = read_integer(payload["job_id"], 1, std::numeric_limits<int32>::max(), job_id);
			if (valid && payload.contains("job_id"))
				valid = pc_jobchange(sd, job_id, 0);
			if (!valid) {
				status = 400;
				result = {{"error", {{"code", "invalid_parameter"}}}};
			} else {
				if (payload.contains("base_level"))
					pc_setparam(sd, SP_BASELEVEL, base_level);
				if (payload.contains("job_level"))
					pc_setparam(sd, SP_JOBLEVEL, job_level);
				status = 200;
				result = {{"data", {{"result", {{"char_id", sd->status.char_id}, {"base_level", sd->status.base_level}, {"job_level", sd->status.job_level}, {"job_id", sd->class_}}}}}};
			}
		}
		} else if (command_type == "character.stats.update") {
		const auto& payload = body["payload"];
		const std::pair<const char*, int64> stats[] = {{"str", SP_STR}, {"agi", SP_AGI}, {"vit", SP_VIT}, {"int", SP_INT}, {"dex", SP_DEX}, {"luk", SP_LUK}};
		bool valid = payload_has_only_keys(payload, {"str", "agi", "vit", "int", "dex", "luk"}) && !payload.empty();
		std::vector<std::pair<int64, int32>> updates;
		if (valid) {
			for (const auto& [name, parameter] : stats) {
				if (!payload.contains(name))
					continue;
				int32 value = 0;
				if (!read_integer(payload[name], 1, std::numeric_limits<int16>::max(), value)) {
					valid = false;
					break;
				}
				updates.emplace_back(parameter, value);
			}
		}
		if (!valid) {
			status = 400;
			result = {{"error", {{"code", "invalid_parameter"}}}};
		} else {
			for (const auto& [parameter, value] : updates)
				pc_setstat(sd, parameter, value);
			status_calc_pc(sd, SCO_FORCE);
			chrif_save(sd, CSAVE_NORMAL);
			status = 200;
			result = {{"data", {{"result", {{"char_id", sd->status.char_id}, {"str", sd->status.str}, {"agi", sd->status.agi}, {"vit", sd->status.vit}, {"int", sd->status.int_}, {"dex", sd->status.dex}, {"luk", sd->status.luk}}}}}};
		}
		} else if (command_type == "character.stats.reset") {
		const auto& payload = body["payload"];
		if (!payload_has_only_keys(payload, {}) || !payload.empty()) {
			status = 400;
			result = {{"error", {{"code", "invalid_parameter"}}}};
		} else if (pc_resetstate(sd) == 0) {
			status = 409;
			result = {{"error", {{"code", "reset_failed"}}}};
		} else {
			status = 200;
			result = {{"data", {{"result", {{"char_id", sd->status.char_id}, {"str", sd->status.str}, {"agi", sd->status.agi}, {"vit", sd->status.vit}, {"int", sd->status.int_}, {"dex", sd->status.dex}, {"luk", sd->status.luk}}}}}};
		}
		} else if (command_type == "monster.spawn") {
		const auto& payload = body["payload"];
		int32 monster_id = 0;
		int32 count = 1;
		int32 radius = 3;
		int32 duration = 60;
		const bool valid = payload_has_only_keys(payload, {"monster_id", "count", "radius", "duration_seconds"})
			&& payload.contains("monster_id") && read_integer(payload["monster_id"], 1, std::numeric_limits<int32>::max(), monster_id)
			&& (!payload.contains("count") || read_integer(payload["count"], 1, 10, count))
			&& (!payload.contains("radius") || read_integer(payload["radius"], 1, 10, radius))
			&& (!payload.contains("duration_seconds") || read_integer(payload["duration_seconds"], 1, 3600, duration))
			&& mobdb_checkid(monster_id);
		if (!valid) {
			status = 400;
			result = {{"error", {{"code", "invalid_parameter"}}}};
		} else {
			nlohmann::json spawned = nlohmann::json::array();
			for (int32 index = 0; index < count; ++index) {
				int16 x = sd->x;
				int16 y = sd->y;
				if (!map_search_freecell(sd, sd->m, &x, &y, radius, radius, 0))
					continue;
				const int32 id = mob_once_spawn(sd, sd->m, x, y, nullptr, monster_id, 1, nullptr, SZ_SMALL, AI_NONE);
				if (id <= 0)
					continue;
				if (mob_data* mob = map_id2md(id))
					mob->deletetimer = add_timer(gettick() + duration * 1000, mob_timer_delete, mob->id, 0);
				spawned.push_back({{"entity_id", id}, {"map", mapindex_id2name(map_getmapdata(sd->m)->index)}, {"x", x}, {"y", y}});
			}
			if (spawned.empty()) {
				status = 409;
				result = {{"error", {{"code", "no_spawn_cell"}}}};
			} else {
				status = 200;
				result = {{"data", {{"result", {{"spawned", spawned}}}}}};
			}
		}
		} else if (command_type == "character.skills.reset") {
		if (!body["payload"].empty()) {
			status = 400;
			result = {{"error", {{"code", "invalid_parameter"}}}};
		} else {
			pc_resetskill(sd, 1);
			status = 200;
			result = {{"data", {{"result", {{"char_id", sd->status.char_id}, {"skill_points", sd->status.skill_point}}}}}};
		}
		} else if (command_type == "character.vitals.restore") {
		const auto& payload = body["payload"];
		const auto vitals = payload.contains("vitals") && payload["vitals"].is_array()
			? payload["vitals"]
			: nlohmann::json::array({"hp", "sp", "ap"});
		bool valid = payload_has_only_keys(payload, {"vitals"})
			&& (!payload.contains("vitals") || payload["vitals"].is_array());
		for (const auto& vital : vitals)
			valid = valid && vital.is_string() && (vital == "hp" || vital == "sp" || vital == "ap");
		if (!valid) {
			status = 400;
			result = {{"error", {{"code", "invalid_parameter"}}}};
		} else {
			for (const auto& vital : vitals) {
				if (vital == "hp") pc_setparam(sd, SP_HP, sd->battle_status.max_hp);
				else if (vital == "sp") pc_setparam(sd, SP_SP, sd->battle_status.max_sp);
				else pc_setparam(sd, SP_AP, sd->battle_status.max_ap);
			}
			status = 200;
			result = {{"data", {{"result", {{"char_id", sd->status.char_id}, {"hp", sd->battle_status.hp}, {"sp", sd->battle_status.sp}, {"ap", sd->battle_status.ap}}}}}};
		}
		}
	}
	const std::string output = response(status, result);
#ifndef _WIN32
	send(request.fd, output.data(), output.size(), 0);
#endif
	close_request(request.fd);
}
