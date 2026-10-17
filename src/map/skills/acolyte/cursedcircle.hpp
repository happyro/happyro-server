// Copyright (c) rAthena Dev Teams - Licensed under GNU GPL
// For more information, see LICENCE in the main folder

#pragma once

#include "../skill_impl.hpp"

class SkillCursedCircle : public SkillImpl {
public:
	SkillCursedCircle(e_skill skill_id = SR_CURSEDCIRCLE, int32 binding_rate = 100);

	void castendNoDamageId(block_list* src, block_list* target, uint16 skill_lv, t_tick tick, int32& flag) const override;

private:
	const int32 binding_rate;
};
