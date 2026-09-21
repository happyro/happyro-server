// Copyright (c) rAthena Dev Teams - Licensed under GNU GPL

#include "game_control.hpp"
#include "game_control_item_grant.hpp"
#include "game_control_traits.hpp"
#include "game_control_skills.hpp"
#include "game_control_navigation.hpp"

#include <algorithm>
#include <condition_variable>
#include <deque>
#include <climits>
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
#include <unordered_map>
#include <vector>

#include <nlohmann/json.hpp>

#include <common/showmsg.hpp>
#include <common/strlib.hpp>

#include "map.hpp"
#include "map_channel.hpp"
#include "battle.hpp"
#include "chrif.hpp"
#include "clif.hpp"
#include "log.hpp"
#include "mob.hpp"
#include "pc.hpp"
#include "status.hpp"

#ifndef _WIN32
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/un.h>
#include <unistd.h>
#endif

namespace {
	constexpr int64 GAME_CONTROL_MAX_STAT = SHRT_MAX;

	int32 stat_safe_max(const map_session_data* sd, e_params parameter) {
		(void)sd;
		(void)parameter;
		return GAME_CONTROL_MAX_STAT;
	}
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
std::unordered_map<std::string, std::string> resource_grant_responses;
std::deque<std::string> resource_grant_response_order;
constexpr size_t RESOURCE_GRANT_RESPONSE_CACHE_SIZE = 256;

bool is_resource_grant_command(const std::string& command_type) {
	return command_type == "character.inventory.item_grant" || command_type == "character.currency.zeny_grant";
}

struct GameControlSettingDefinition {
	const char* key;
	int64 minimum;
	int64 maximum;
};

constexpr GameControlSettingDefinition game_control_settings[] = {
	{"base_exp_rate", 0, std::numeric_limits<int32>::max()},
	{"job_exp_rate", 0, std::numeric_limits<int32>::max()},
	{"item_rate_common", 0, 1000000},
	{"item_rate_common_boss", 0, 1000000},
	{"item_rate_common_mvp", 0, 1000000},
	{"item_rate_heal", 0, 1000000},
	{"item_rate_heal_boss", 0, 1000000},
	{"item_rate_heal_mvp", 0, 1000000},
	{"item_rate_use", 0, 1000000},
	{"item_rate_use_boss", 0, 1000000},
	{"item_rate_use_mvp", 0, 1000000},
	{"item_rate_equip", 0, 1000000},
	{"item_rate_equip_boss", 0, 1000000},
	{"item_rate_equip_mvp", 0, 1000000},
	{"item_rate_card", 0, 1000000},
	{"item_rate_card_boss", 0, 1000000},
	{"item_rate_card_mvp", 0, 1000000},
	{"navigation_teleport_policy", 0, 2},
	{"navigation_teleport_cross_map", 0, 1},
	{"navigation_teleport_cooldown", 0, 3600},
	{"navigation_map_channels_enabled", 0, 1},
	{"game_tools_monster_spawn_policy", 0, 2},
	{"game_tools_monster_spawn_cooldown", 0, 3600},
	{"game_tools_monster_spawn_duration", 1, 3600},
	{"game_tools_monster_spawn_allow_boss", 0, 1},
	{"game_tools_character_maintenance_policy", 1, 2},
	{"game_tools_game_settings_policy", 1, 2},
	{"game_tools_item_grant_policy", 1, 2},
};

const GameControlSettingDefinition* find_game_control_setting(const std::string& key) {
	return std::find_if(std::begin(game_control_settings), std::end(game_control_settings),
		[&](const auto& definition) { return key == definition.key; });
}

struct CommandResult {
	int status;
	nlohmann::json body;
};

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

int32 merge_map_channel_player(map_session_data* sd, va_list args) {
	(void)args;
	map_channel_normalize_name(sd->status.save_point.map, sizeof(sd->status.save_point.map));
	const char* current_map = mapindex_id2name(sd->mapindex);
	const char* canonical_map = map_channel_canonical_name(current_map);
	if (std::strcmp(current_map, canonical_map) != 0)
		pc_setpos(sd, mapindex_name2id(canonical_map), sd->x, sd->y, CLR_TELEPORT);
	return 0;
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

uint32 max_job_level(int32 job_id) {
	return job_id >= 0 && job_db.exists(job_id) ? job_db.get_maxJobLv(job_id) : 1;
}

uint32 earned_job_skill_points(const map_session_data* sd) {
	uint32 earned = sd->status.job_level - 1;
	const uint64 variant = sd->class_ & (JOBL_UPPER | JOBL_BABY);
	const uint64 first_class = sd->class_ & MAPID_FIRSTMASK;

	if (first_class != MAPID_SUMMONER && (first_class != MAPID_NOVICE || (sd->class_ & JOBL_2)))
		earned += max_job_level(JOB_NOVICE) - 1;
	if ((sd->class_ & JOBL_2) && (sd->class_ & MAPID_SECONDMASK) != MAPID_SUPER_NOVICE) {
		const int32 first_job = pc_mapid2jobid(first_class | variant, sd->status.sex);
		earned += max_job_level(first_job) - 1;
	}
	if (sd->class_ & JOBL_THIRD) {
		const int32 second_job = pc_mapid2jobid((sd->class_ & MAPID_SECONDMASK) | variant, sd->status.sex);
		earned += max_job_level(second_job) - 1;
	}
	if (sd->class_ & JOBL_FOURTH) {
		const int32 third_job = pc_mapid2jobid(sd->class_ & MAPID_THIRDMASK, sd->status.sex);
		earned += max_job_level(third_job) - 1;
	}

	return earned;
}

uint32 extra_job_skill_points(map_session_data* sd) {
	const uint32 accounted = sd->status.skill_point + pc_calc_skillpoint(sd);
	const uint32 earned = earned_job_skill_points(sd);
	return accounted > earned ? accounted - earned : 0;
}

void reconcile_job_skill_points(map_session_data* sd, uint32 extra) {
	const uint32 spent = pc_calc_skillpoint(sd);
	const uint32 entitled = earned_job_skill_points(sd) + extra;
	sd->status.skill_point = entitled > spent ? std::min(entitled - spent, static_cast<uint32>(INT16_MAX)) : 0;
	clif_updatestatus(*sd, SP_SKILLPOINT);
}

void reset_job_change_levels(map_session_data* sd) {
	sd->change_level_2nd = 0;
	sd->change_level_3rd = 0;
	sd->change_level_4th = 0;
	pc_setglobalreg(sd, add_str(JOBCHANGE2ND_VAR), 0);
	pc_setglobalreg(sd, add_str(JOBCHANGE3RD_VAR), 0);
	pc_setglobalreg(sd, add_str(JOBCHANGE4TH_VAR), 0);
}

CommandResult process_battle_config_command(const std::string& command_type, const nlohmann::json& body) {
	if (command_type == "battle_config.read") {
		nlohmann::json values = nlohmann::json::object();
		for (const auto& definition : game_control_settings)
			values[definition.key] = battle_get_value(definition.key);
		return {200, nlohmann::json{{"data", {{"result", {{"values", values}}}}}}};
	}

	const auto& payload = body["payload"];
	const auto changes = payload.contains("changes") && payload["changes"].is_array()
		? payload["changes"]
		: nlohmann::json::array();
	bool valid = payload_has_only_keys(payload, {"changes"}) && !changes.empty();
	std::unordered_set<std::string> keys;
	for (const auto& change : changes) {
		if (!change.is_object() || !payload_has_only_keys(change, {"key", "value"})
			|| !change.contains("key") || !change["key"].is_string() || !change.contains("value")) {
			valid = false;
			break;
		}
		const std::string key = change["key"].get<std::string>();
		const auto* definition = find_game_control_setting(key);
		int32 value = 0;
		if (definition == nullptr || !keys.insert(key).second
			|| !read_integer(change["value"], definition->minimum, definition->maximum, value)) {
			valid = false;
			break;
		}
	}
	if (!valid)
		return {400, {{"error", {{"code", "invalid_parameter"}}}}};

	nlohmann::json applied = nlohmann::json::array();
	std::vector<std::pair<std::string, int32>> previous_values;
	for (const auto& change : changes) {
		const std::string key = change["key"].get<std::string>();
		const int32 previous = battle_get_value(key.c_str());
		const std::string value = std::to_string(change["value"].get<int64>());
		if (battle_set_value(key.c_str(), value.c_str()) == 0) {
			valid = false;
			break;
		}
		previous_values.emplace_back(key, previous);
		applied.push_back({{"key", key}, {"previous", previous}, {"value", battle_get_value(key.c_str())}});
	}
	if (!valid) {
		for (auto it = previous_values.rbegin(); it != previous_values.rend(); ++it) {
			const std::string previous = std::to_string(it->second);
			battle_set_value(it->first.c_str(), previous.c_str());
		}
		return {409, {{"error", {{"code", "configuration_conflict"}}}}};
	}

	const bool reload_mob_database = keys.count("base_exp_rate") != 0
		|| keys.count("job_exp_rate") != 0
		|| keys.count("item_rate_common") != 0
		|| keys.count("item_rate_common_boss") != 0
		|| keys.count("item_rate_common_mvp") != 0
		|| keys.count("item_rate_heal") != 0
		|| keys.count("item_rate_heal_boss") != 0
		|| keys.count("item_rate_heal_mvp") != 0
		|| keys.count("item_rate_use") != 0
		|| keys.count("item_rate_use_boss") != 0
		|| keys.count("item_rate_use_mvp") != 0
		|| keys.count("item_rate_equip") != 0
		|| keys.count("item_rate_equip_boss") != 0
		|| keys.count("item_rate_equip_mvp") != 0
		|| keys.count("item_rate_card") != 0
		|| keys.count("item_rate_card_boss") != 0
		|| keys.count("item_rate_card_mvp") != 0;
	if (reload_mob_database)
		mob_reload();

	if (keys.count("navigation_teleport_policy") != 0
		|| keys.count("navigation_teleport_cross_map") != 0
		|| keys.count("navigation_teleport_cooldown") != 0
		|| keys.count("navigation_map_channels_enabled") != 0)
		clif_navigation_teleport_config_all();
	if (keys.count("navigation_map_channels_enabled") != 0 && !battle_config.navigation_map_channels_enabled)
		map_foreachpc(merge_map_channel_player);
	if (keys.count("game_tools_monster_spawn_policy") != 0
		|| keys.count("game_tools_monster_spawn_cooldown") != 0
		|| keys.count("game_tools_monster_spawn_allow_boss") != 0)
		clif_game_tools_monster_spawn_config_all();

	return {200, {{"data", {{"result", {{"changes", applied}}}}}}};
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
	const std::string command_type = body.is_object() ? body.value("type", "") : "";
	const std::string command_id = body.is_object() ? body.value("id", "") : "";
	if (is_resource_grant_command(command_type) && !command_id.empty()) {
		const auto cached = resource_grant_responses.find(command_id);
		if (cached != resource_grant_responses.end()) {
#ifndef _WIN32
			send(request.fd, cached->second.data(), cached->second.size(), 0);
#endif
			close_request(request.fd);
			return;
		}
	}
	if (!body.is_object() || !body.contains("type") || !body["type"].is_string()
		|| !body.contains("payload") || !body["payload"].is_object()) {
		// Keep the default invalid-command response.
	} else if (command_type == "battle_config.read" || command_type == "battle_config.apply") {
		const CommandResult command = process_battle_config_command(command_type, body);
		status = command.status;
		result = command.body;
	} else if (body["type"].get<std::string>() == "capabilities") {
		status = 200;
		result = {{"data", {{"protocol_version", "1"}, {"commands", {"character.snapshot", "character.navigation.teleport", "character.navigation.route", "character.progression.update", "character.points.update", "character.skill_points.update", "character.stats.update", "character.stats.reset", "character.traits.update", "character.traits.reset", "character.skills.reset", "character.skills.learn_all", "character.vitals.restore", "character.inventory.item_grant", "character.currency.zeny_grant", "monster.spawn", "battle_config.apply"}}}}};
	} else if (command_type != "character.snapshot"
		&& command_type != "character.progression.update"
		&& command_type != "character.points.update"
		&& command_type != "character.skill_points.update"
		&& command_type != "character.stats.update"
		&& command_type != "character.stats.reset"
		&& command_type != "character.traits.update"
		&& command_type != "character.traits.reset"
		&& command_type != "character.skills.reset"
		&& command_type != "character.skills.learn_all"
		&& command_type != "character.navigation.teleport"
		&& command_type != "character.navigation.route"
		&& command_type != "character.vitals.restore"
		&& command_type != "character.inventory.item_grant"
		&& command_type != "character.currency.zeny_grant"
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
		} else if (command_type == "character.navigation.route") {
			const auto navigation = game_control_route(sd, body["payload"]);
			status = navigation.status;
			result = navigation.body;
		} else if (command_type == "character.navigation.teleport") {
			const auto navigation = game_control_teleport(sd, body["payload"]);
			status = navigation.status;
			result = navigation.body;
		} else if (command_type == "character.inventory.item_grant") {
			const GameControlItemGrantResult grant = game_control_grant_inventory_item(sd, body["payload"]);
			status = grant.status;
			result = grant.body;
		} else if (command_type == "character.currency.zeny_grant") {
			const auto& payload = body["payload"];
			int32 amount = 0;
			if (!payload_has_only_keys(payload, {"amount"}) || !payload.contains("amount")
				|| !read_integer(payload["amount"], 1, MAX_ZENY, amount)) {
				status = 400;
				result = {{"error", {{"code", "invalid_parameter"}}}};
			} else if (amount > MAX_ZENY - sd->status.zeny) {
				status = 409;
				result = {{"error", {{"code", "zeny_amount_exceeded"}}}};
			} else {
				pc_getzeny(sd, amount, LOG_TYPE_COMMAND);
				chrif_save(sd, CSAVE_NORMAL);
				status = 200;
				result = {{"data", {{"result", {{"char_id", sd->status.char_id}, {"amount", amount}, {"zeny", sd->status.zeny}}}}}};
			}
		} else if (command_type == "character.snapshot") {
			if (!body["payload"].empty()) {
				status = 400;
				result = {{"error", {{"code", "invalid_parameter"}}}};
			} else {
				status = 200;
				result = {{"data", {{"result", {
					{"char_id", sd->status.char_id}, {"name", sd->status.name}, {"base_level", sd->status.base_level},
					{"job_level", sd->status.job_level}, {"job_id", sd->status.class_}, {"str", sd->status.str},
					{"agi", sd->status.agi}, {"vit", sd->status.vit}, {"int", sd->status.int_}, {"dex", sd->status.dex},
					{"luk", sd->status.luk}, {"status_points", sd->status.status_point}, {"skill_points", sd->status.skill_point}, {"zeny", sd->status.zeny},
					{"hp", sd->battle_status.hp}, {"max_hp", sd->battle_status.max_hp}, {"sp", sd->battle_status.sp},
					{"max_sp", sd->battle_status.max_sp}, {"ap", sd->battle_status.ap}, {"max_ap", sd->battle_status.max_ap},
					{"sex", sd->status.sex}, {"traits", game_control_traits_snapshot(sd)},
					{"max_base_level", pc_maxbaselv(sd)}, {"max_job_level", pc_maxjoblv(sd)},
					{"max_skill_points", INT16_MAX}, {"max_status_points", INT32_MAX},
					{"max_stat", stat_safe_max(sd, PARAM_STR)},
					{"max_stats", { {"str", stat_safe_max(sd, PARAM_STR)}, {"agi", stat_safe_max(sd, PARAM_AGI)},
						{"vit", stat_safe_max(sd, PARAM_VIT)}, {"int", stat_safe_max(sd, PARAM_INT)},
						{"dex", stat_safe_max(sd, PARAM_DEX)}, {"luk", stat_safe_max(sd, PARAM_LUK)} }},
					{"map", mapindex_id2name(sd->mapindex)}, {"x", sd->x}, {"y", sd->y}
				}}}}};
				auto& jobs = result["data"]["result"]["jobs"] = nlohmann::json::array();
				for (int32 job = 0; job < JOB_MAX; ++job) {
					if (!job_db.exists(job) || job == JOB_WEDDING || job == JOB_XMAS || job == JOB_SUMMER)
						continue;
					const uint64 map_id = pc_jobid2mapid(job);
					if (map_id == static_cast<uint64>(-1) || pc_mapid2jobid(map_id, sd->status.sex) != job)
						continue;
					jobs.push_back({{"id", job}, {"max_base_level", job_db.get_maxBaseLv(job)},
						{"max_job_level", job_db.get_maxJobLv(job)}, {"traits", static_cast<bool>(pc_is_trait_job(map_id))}});
				}
			}
		} else if (command_type == "character.progression.update") {
			const auto& payload = body["payload"];
			if (!payload_has_only_keys(payload, {"base_level", "job_level", "job_id"}) || payload.empty()) {
				status = 400;
				result = {{"error", {{"code", "invalid_parameter"}}}};
			} else {
				bool valid = true;
				int32 base_level = sd->status.base_level;
				int32 job_level = 0;
				int32 job_id = sd->status.class_;
				bool changed_job = false;
				const bool changes_job_progression = payload.contains("job_level") || payload.contains("job_id");
				const uint32 extra_skill_points = changes_job_progression ? extra_job_skill_points(sd) : 0;
				if (valid && payload.contains("job_id"))
					valid = read_integer(payload["job_id"], 0, JOB_MAX - 1, job_id);
				if (valid && payload.contains("job_id")) {
					const uint64 map_id = pc_jobid2mapid(job_id);
					const int32 normalized_job_id = map_id == static_cast<uint64>(-1)
						? -1
						: pc_mapid2jobid(map_id, sd->status.sex);
					valid = normalized_job_id == job_id && job_db.exists(job_id)
						&& job_id != JOB_WEDDING && job_id != JOB_XMAS && job_id != JOB_SUMMER;
				}
				if (valid && payload.contains("base_level"))
					valid = read_integer(payload["base_level"], 1, job_db.get_maxBaseLv(job_id), base_level);
				if (valid)
					valid = base_level <= job_db.get_maxBaseLv(job_id);
				if (valid && payload.contains("job_level"))
					valid = read_integer(payload["job_level"], 1, job_db.get_maxJobLv(job_id), job_level);
				if (!valid) {
					status = 400;
					result = {{"error", {{"code", "invalid_parameter"}}}};
				} else {
					// All requested values are valid before any character mutation.
					// Lower the level before changing jobs so pc_jobchange cannot silently cap it.
					if (base_level < sd->status.base_level) {
						const uint32 refund = statpoint_db.get_table_point(sd->status.base_level)
							- statpoint_db.get_table_point(base_level);
						pc_setparam(sd, SP_BASELEVEL, base_level);
						if (sd->status.status_point < refund)
							game_control_base_stats_reset(sd);
						else {
							sd->status.status_point -= refund;
							clif_updatestatus(*sd, SP_STATUSPOINT);
						}
					}
					if (job_id != sd->status.class_) {
						// Game Control can cross unrelated class trees. Rebuild the
						// advancement history so skill-up limits use the new lineage.
						reset_job_change_levels(sd);
						changed_job = pc_jobchange(sd, job_id, 0);
					}
					if (payload.contains("base_level"))
						pc_setparam(sd, SP_BASELEVEL, base_level);
					if (payload.contains("job_level"))
						pc_setparam(sd, SP_JOBLEVEL, job_level);
					if (changes_job_progression)
						reconcile_job_skill_points(sd, extra_skill_points);
					game_control_traits_reconcile(sd);
					if (changed_job) {
						if (pc_isdead(sd))
							status_revive(sd, 100, 100, 100);
						else {
							pc_setparam(sd, SP_HP, sd->battle_status.max_hp);
							pc_setparam(sd, SP_SP, sd->battle_status.max_sp);
							pc_setparam(sd, SP_AP, sd->battle_status.max_ap);
						}
					}
					chrif_save(sd, CSAVE_NORMAL);
					status = 200;
					result = {{"data", {{"result", {{"char_id", sd->status.char_id}, {"base_level", sd->status.base_level}, {"job_level", sd->status.job_level}, {"job_id", sd->status.class_}, {"skill_points", sd->status.skill_point}}}}}};
				}
			}
		} else if (command_type == "character.points.update") {
			const auto& payload = body["payload"];
			int32 skill_points = 0, status_points = 0;
			const bool valid = payload_has_only_keys(payload, {"skill_points", "status_points"}) && !payload.empty()
				&& (!payload.contains("skill_points") || read_integer(payload["skill_points"], 0, INT16_MAX, skill_points))
				&& (!payload.contains("status_points") || read_integer(payload["status_points"], 0, INT32_MAX, status_points));
			if (!valid) {
				status = 400;
				result = {{"error", {{"code", "invalid_parameter"}}}};
			} else {
				// Validate both balances before changing either one.
				if (payload.contains("skill_points"))
					pc_setparam(sd, SP_SKILLPOINT, skill_points);
				if (payload.contains("status_points"))
					pc_setparam(sd, SP_STATUSPOINT, status_points);
				chrif_save(sd, CSAVE_NORMAL);
				status = 200;
				result = {{"data", {{"result", {{"char_id", sd->status.char_id},
					{"skill_points", sd->status.skill_point}, {"status_points", sd->status.status_point}}}}}};
			}
		} else if (command_type == "character.skill_points.update") {
			const auto& payload = body["payload"];
			int32 skill_points = 0;
			if (!payload_has_only_keys(payload, {"skill_points"}) || !payload.contains("skill_points")
				|| !read_integer(payload["skill_points"], 0, INT16_MAX, skill_points)) {
				status = 400;
				result = {{"error", {{"code", "invalid_parameter"}}}};
			} else {
				pc_setparam(sd, SP_SKILLPOINT, skill_points);
				clif_updatestatus(*sd, SP_SKILLPOINT);
				chrif_save(sd, CSAVE_NORMAL);
				status = 200;
				result = {{"data", {{"result", {{"char_id", sd->status.char_id}, {"skill_points", sd->status.skill_point}}}}}};
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
				if (!read_integer(payload[name], 1, stat_safe_max(sd, static_cast<e_params>(parameter)), value)) {
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
		} else if (command_type == "character.traits.update" || command_type == "character.traits.reset") {
			const auto& payload = body["payload"];
			const bool reset = command_type == "character.traits.reset";
			const bool valid = reset
				? pc_is_trait_job(sd->class_) && payload_has_only_keys(payload, {})
				: game_control_traits_update(sd, payload);
			if (!valid) {
				status = 400;
				result = {{"error", {{"code", "invalid_parameter"}}}};
			} else {
				if (reset)
					game_control_traits_reconcile(sd, true);
				chrif_save(sd, CSAVE_NORMAL);
				status = 200;
				result = {{"data", {{"result", {{"traits", game_control_traits_snapshot(sd)}}}}}};
			}
		} else if (command_type == "character.stats.reset") {
		const auto& payload = body["payload"];
		if (!payload_has_only_keys(payload, {}) || !payload.empty()) {
			status = 400;
			result = {{"error", {{"code", "invalid_parameter"}}}};
		} else {
			game_control_base_stats_reset(sd);
			chrif_save(sd, CSAVE_NORMAL);
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
			for (const auto& entry : mob_spawn_temporary_near(sd, monster_id, count, radius, duration))
				spawned.push_back({{"entity_id", entry.entity_id}, {"map", mapindex_id2name(map_getmapdata(entry.map_id)->index)}, {"x", entry.x}, {"y", entry.y}});
			if (spawned.empty()) {
				status = 409;
				result = {{"error", {{"code", "no_spawn_cell"}}}};
			} else {
				status = 200;
				result = {{"data", {{"result", {{"spawned", spawned}}}}}};
			}
		}
		} else if (command_type == "character.skills.learn_all") {
		if (!body["payload"].empty()) {
			status = 400;
			result = {{"error", {{"code", "invalid_parameter"}}}};
		} else {
			const int32 learned = game_control_learn_job_skills(sd);
			status = 200;
			result = {{"data", {{"result", {{"char_id", sd->status.char_id}, {"learned_skills", learned}, {"skill_points", sd->status.skill_point}}}}}};
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
			bool restore_hp = false;
			bool restore_sp = false;
			bool restore_ap = false;
			for (const auto& vital : vitals) {
				if (vital == "hp") restore_hp = true;
				else if (vital == "sp") restore_sp = true;
				else restore_ap = true;
			}
			if (restore_hp && pc_isdead(sd))
				status_revive(sd, 100, restore_sp ? 100 : 0, restore_ap ? 100 : 0);
			else {
				if (restore_hp) pc_setparam(sd, SP_HP, sd->battle_status.max_hp);
				if (restore_sp) pc_setparam(sd, SP_SP, sd->battle_status.max_sp);
				if (restore_ap) pc_setparam(sd, SP_AP, sd->battle_status.max_ap);
			}
			status = 200;
			result = {{"data", {{"result", {{"char_id", sd->status.char_id}, {"hp", sd->battle_status.hp}, {"sp", sd->battle_status.sp}, {"ap", sd->battle_status.ap}}}}}};
		}
		}
	}
	const std::string output = response(status, result);
	if (is_resource_grant_command(command_type) && !command_id.empty()) {
		resource_grant_responses[command_id] = output;
		resource_grant_response_order.push_back(command_id);
		if (resource_grant_response_order.size() > RESOURCE_GRANT_RESPONSE_CACHE_SIZE) {
			resource_grant_responses.erase(resource_grant_response_order.front());
			resource_grant_response_order.pop_front();
		}
	}
#ifndef _WIN32
	send(request.fd, output.data(), output.size(), 0);
#endif
	close_request(request.fd);
}
