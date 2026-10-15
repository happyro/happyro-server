#include "game_control_riding.hpp"
#include <algorithm>
#include <vector>

#include "pc.hpp"
#include "skill.hpp"
#include "status.hpp"
#include "clif.hpp"
#include "battle.hpp"
#include "chrif.hpp"
#include "log.hpp"
#include "script.hpp"
#include <common/strlib.hpp>

namespace {
struct Rental {
	const char* kind;
	int skill;
	int fee;
	bool eligible;
	bool active;
	bool use_skill = false;
};

// Sources: npc/kafras/{kafras,functions_kafras}.txt (Prontera),
// npc/merchants/renters.txt and npc/re/merchants/renters.txt.
std::vector<Rental> rentals(map_session_data* sd) {
	const auto job = sd->class_ & MAPID_THIRDMASK;
	const bool mechanic = job == MAPID_MECHANIC;
	const bool crusader = job == MAPID_CRUSADER;
	const bool windhawk = (sd->class_ & MAPID_FOURTHMASK) == MAPID_WINDHAWK;
	const bool hunter = (sd->class_ & MAPID_SECONDMASK) == MAPID_HUNTER;
	return {
		{"cart", MC_PUSHCART, mechanic ? 0 : 800, (sd->class_ & MAPID_FIRSTMASK) == MAPID_MERCHANT, !!pc_iscarton(sd)},
		{"peco", KN_RIDING, crusader ? 3500 : 2500, job == MAPID_KNIGHT || crusader, !!pc_isriding(sd) && job != MAPID_ROYAL_GUARD},
		{"dragon", RK_DRAGONTRAINING, 0, job == MAPID_RUNE_KNIGHT, !!pc_isridingdragon(sd)},
		{"gryphon", KN_RIDING, 0, job == MAPID_ROYAL_GUARD, !!pc_isriding(sd) && job == MAPID_ROYAL_GUARD},
		{"mado", NC_MADOLICENCE, 0, mechanic, !!pc_ismadogear(sd)},
		{"falcon", HT_FALCON, 2500, hunter && !windhawk, !!pc_isfalcon(sd) && !windhawk},
		{"warg", RA_WUGMASTERY, 0, job == MAPID_RANGER, !!(pc_iswug(sd) || pc_isridingwug(sd)), true},
		{"warg_rider", RA_WUGRIDER, 0, job == MAPID_RANGER, !!pc_isridingwug(sd), true},
		{"hawk", WH_HAWK_M, 0, windhawk, !!pc_isfalcon(sd) && windhawk, true},
	};
}

const char* blocked(map_session_data* sd, const Rental& rental) {
	if (pc_isdead(sd) || sd->npc_id || sd->trade_partner.id || sd->state.storage_flag || sd->state.vending || sd->state.buyingstore)
		return "riding_busy";
	const std::string kind = rental.kind;
	if (kind == "warg" && pc_isridingwug(sd)) return "riding_dismount_warg";
	if (rental.active && !rental.use_skill) return "";
	if (!rental.eligible) return "riding_job_required";
	if (!pc_checkskill(sd, rental.skill)) return "riding_skill_required";
	if (kind == "warg_rider" && !rental.active && !pc_iswug(sd)) return "riding_warg_required";
	if (kind == "falcon" && (pc_iswug(sd) || pc_isridingwug(sd))) return "riding_falcon_conflict";
	if ((kind == "warg" || kind == "warg_rider") && pc_isfalcon(sd)
		&& !pc_checkskill(sd, WH_HAWK_M) && !battle_config.warg_can_falcon) return "riding_warg_conflict";
	if (rental.use_skill) return ""; // Other skill conditions are checked at execution time.
	if (kind != "cart" && kind != "falcon" && (sd->sc.getSCE(SC_ALL_RIDING)
		|| (sd->sc.option & (OPTION_RIDING | OPTION_DRAGON | OPTION_MADOGEAR)))) return "riding_conflict";
	return "";
}

bool uses_ticket(map_session_data* sd, const Rental& rental) {
	return !rental.active && std::string(rental.kind) == "cart" && rental.fee > 0 && pc_search_inventory(sd, 7061) >= 0;
}
}

nlohmann::json game_control_riding_snapshot(map_session_data* sd) {
	auto entries = nlohmann::json::array();
	for (const auto& rental : rentals(sd)) {
		if (!rental.eligible && !rental.active) continue;
		const bool ticket = uses_ticket(sd, rental);
		const int fee = rental.active || ticket ? 0 : rental.fee;
		std::string reason = blocked(sd, rental);
		if (reason.empty() && sd->status.zeny < fee) reason = "riding_insufficient_zeny";
		entries.push_back({{"kind", rental.kind}, {"active", rental.active}, {"fee", fee},
			{"ticket", ticket}, {"reason", reason}});
	}
	return entries;
}

GameControlRidingResult game_control_riding_update(map_session_data* sd, const nlohmann::json& payload) {
	const auto error = [](const char* code, int status = 409) -> GameControlRidingResult {
		return {status, {{"error", {{"code", code}}}}};
	};
	if (!payload.is_object() || payload.size() != 4 || !payload.contains("kind") || !payload["kind"].is_string()
		|| !payload.contains("enabled") || !payload["enabled"].is_boolean()
		|| !payload.contains("fee") || !payload["fee"].is_number_integer() || payload["fee"] < 0 || payload["fee"] > 3500
		|| !payload.contains("ticket") || !payload["ticket"].is_boolean()) return error("invalid_parameter", 400);
	const auto kind = payload["kind"].get<std::string>();
	const bool enabled = payload["enabled"].get<bool>();
	const auto options = rentals(sd);
	const auto found = std::find_if(options.begin(), options.end(), [&](const Rental& rental) { return kind == rental.kind; });
	if (found == options.end()) return error("invalid_parameter", 400);
	const auto& rental = *found;
	if (rental.active == enabled) return error("riding_state_changed");
	const auto reason = blocked(sd, rental);
	if (*reason) return error(reason);
	const bool ticket = uses_ticket(sd, rental);
	const int fee = enabled && !ticket ? rental.fee : 0;
	if (payload["fee"] != fee || payload["ticket"] != ticket) return error("riding_quote_changed");
	if (sd->status.zeny < fee) return error("riding_insufficient_zeny");
	if (rental.use_skill) {
		// Match the normal skill entry gates, including map restrictions and action delay.
		if (sd->skillitem || sd->ud.skilltimer != INVALID_TIMER || DIFF_TICK(gettick(), sd->ud.canact_tick) < 0)
			return error("riding_skill_busy");
		clif_parse_skill_toid(sd, rental.skill, pc_checkskill(sd, rental.skill), sd->id);
		// These self-targeted skills have no cast time. Validate the resulting state,
		// since cast-end checks can still reject the operation after cast-begin succeeds.
		const auto current = rentals(sd);
		const auto updated = std::find_if(current.begin(), current.end(), [&](const Rental& value) { return kind == value.kind; });
		if (updated->active != enabled) return error("riding_skill_failed");
	} else {
		// All validation completes before spending resources. Map commands execute on the map thread.
		if (ticket && pc_delitem(sd, pc_search_inventory(sd, 7061), 1, 0, 0, LOG_TYPE_COMMAND)) return error("riding_quote_changed");
		if (fee && pc_payzeny(sd, fee, LOG_TYPE_COMMAND)) return error("riding_insufficient_zeny");
		if (kind == "cart") {
			pc_setcart(sd, enabled ? 1 : 0);
			if (enabled && fee) pc_setglobalreg(sd, add_str("RESRVPTS"), pc_readglobalreg(sd, add_str("RESRVPTS")) + 48);
		} else if (kind == "mado") {
			// Only this option changes; a coexisting cart remains installed.
			pc_setoption(sd, enabled ? sd->sc.option | OPTION_MADOGEAR : sd->sc.option & ~OPTION_MADOGEAR);
		} else if (kind == "falcon") {
			pc_setoption(sd, enabled ? sd->sc.option | OPTION_FALCON : sd->sc.option & ~OPTION_FALCON);
		} else if (kind == "dragon") {
			pc_setoption(sd, enabled ? sd->sc.option | OPTION_DRAGON1 : sd->sc.option & ~OPTION_DRAGON);
		} else {
			pc_setoption(sd, enabled ? sd->sc.option | OPTION_RIDING : sd->sc.option & ~OPTION_RIDING);
		}
	}
	chrif_save(sd, CSAVE_NORMAL);
	return {200, {{"data", {{"result", {{"char_id", sd->status.char_id}, {"riding", game_control_riding_snapshot(sd)}}}}}}};
}
