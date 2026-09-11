// Copyright (c) rAthena Dev Teams - Licensed under GNU GPL

#include "game_control_item_grant.hpp"

#include <limits>
#include <vector>

#include <common/mmo.hpp>

#include "chrif.hpp"
#include "itemdb.hpp"
#include "log.hpp"
#include "pc.hpp"

namespace {
bool read_integer(const nlohmann::json& value, int32 minimum, int32 maximum, int32& result) {
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

const char* error_code(e_additem_result result) {
	switch (result) {
		case ADDITEM_OVERWEIGHT: return "inventory_overweight";
		case ADDITEM_OVERITEM: return "inventory_full";
		case ADDITEM_OVERAMOUNT:
		case ADDITEM_STACKLIMIT: return "item_amount_exceeded";
		default: return "item_grant_failed";
	}
}
}

GameControlItemGrantResult game_control_grant_inventory_item(
	map_session_data* sd,
	const nlohmann::json& payload
) {
	if (!payload.is_object() || (payload.size() != 2 && payload.size() != 3) || !payload.contains("item_id")
		|| !payload.contains("amount") || (payload.size() == 3 && !payload.contains("identify")))
		return {400, {{"error", {{"code", "invalid_parameter"}}}}};

	int32 item_id = 0;
	int32 amount = 0;
	if (!read_integer(payload["item_id"], 1, std::numeric_limits<int32>::max(), item_id)
		|| !read_integer(payload["amount"], 1, MAX_AMOUNT, amount))
		return {400, {{"error", {{"code", "invalid_parameter"}}}}};
	bool identify = false;
	if (payload.contains("identify")) {
		if (!payload["identify"].is_boolean())
			return {400, {{"error", {{"code", "invalid_parameter"}}}}};
		identify = payload["identify"].get<bool>();
	}

	const auto item_data = item_db.find(static_cast<t_itemid>(item_id));
	if (item_data == nullptr || !item_data->flag.available)
		return {422, {{"error", {{"code", "item_not_found"}}}}};
	if (item_data->type == IT_PETEGG)
		return {422, {{"error", {{"code", "item_not_grantable"}}}}};

	const int32 grant_count = itemdb_isstackable2(item_data.get()) ? 1 : amount;
	const int32 grant_amount = grant_count == 1 ? amount : 1;
	if (static_cast<uint64>(sd->weight) + static_cast<uint64>(item_data->weight) * amount > sd->max_weight)
		return {409, {{"error", {{"code", "inventory_overweight"}}}}};
	const e_chkitem_result check = static_cast<e_chkitem_result>(pc_checkadditem(sd, item_data->nameid, grant_amount));
	if (check == CHKADDITEM_OVERAMOUNT)
		return {409, {{"error", {{"code", "item_amount_exceeded"}}}}};
	if (check == CHKADDITEM_NEW && pc_inventoryblank(sd) < item_data->inventorySlotNeeded(amount))
		return {409, {{"error", {{"code", "inventory_full"}}}}};

	std::vector<int32> granted_indexes;
	granted_indexes.reserve(grant_count);
	for (int32 index = 0; index < grant_count; ++index) {
		item granted{};
		granted.nameid = item_data->nameid;
		granted.identify = identify ? 1 : itemdb_isidentified(item_data->nameid);
		int32 empty_slot = -1;
		if (grant_count > 1) {
			for (int32 slot = 0; slot < MAX_INVENTORY; ++slot) {
				if (sd->inventory.u.items_inventory[slot].nameid == 0) {
					empty_slot = slot;
					break;
				}
			}
		}
		const e_additem_result result = pc_additem(sd, &granted, grant_amount, LOG_TYPE_COMMAND);
		if (result != ADDITEM_SUCCESS) {
			for (auto it = granted_indexes.rbegin(); it != granted_indexes.rend(); ++it)
				pc_delitem(sd, *it, grant_amount, 0, 0, LOG_TYPE_COMMAND);
			return {409, {{"error", {{"code", error_code(result)}}}}};
		}
		if (empty_slot >= 0)
			granted_indexes.push_back(empty_slot);
	}

	chrif_save(sd, CSAVE_NORMAL);
	return {200, {{"data", {{"result", {
		{"char_id", sd->status.char_id},
		{"item_id", item_id},
		{"amount", amount}
	}}}}}};
}
