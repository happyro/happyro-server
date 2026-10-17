// Copyright (c) rAthena Dev Teams - Licensed under GNU GPL
// For more information, see LICENCE in the main folder

#include "cursedcircle.hpp"

#include "map/clif.hpp"
#include "map/map.hpp"
#include "map/mob.hpp"
#include "map/pc.hpp"
#include "map/status.hpp"

SkillCursedCircle::SkillCursedCircle(e_skill skill_id, int32 binding_rate) : SkillImpl(skill_id), binding_rate(binding_rate) {
}

// The map iterator counts successful bindings, not no-damage dispatch results.
static int32 cursed_circle_bind_target(block_list* target, va_list ap) {
	block_list* src = va_arg(ap, block_list*);
	uint16 skill_id = va_arg(ap, int32);
	uint16 skill_lv = va_arg(ap, int32);
	int32 binding_rate = va_arg(ap, int32);

	if (status_isdead(*target) || status_get_class_(target) == CLASS_BOSS || battle_check_target(src, target, BCT_ENEMY) <= 0)
		return 0;

	if (!sc_start2(src, target, skill_get_sc(skill_id), binding_rate, skill_lv, src->id, skill_get_time(skill_id, skill_lv)))
		return 0;

	if (target->type == BL_MOB)
		mob_unlocktarget(reinterpret_cast<mob_data*>(target), gettick());
	clif_bladestop(*src, target->id, true);
	return 1;
}

void SkillCursedCircle::castendNoDamageId(block_list* src, block_list* target, uint16 skill_lv, t_tick tick, int32& flag) const {
	map_session_data* sd = BL_CAST(BL_PC, src);
	const int32 limit = sd ? min(sd->spiritball, sd->spiritball_old) : 15;

	clif_skill_damage(*src, *target, tick, status_get_amotion(src), 0, DMGVAL_IGNORE, 1, getSkillId(), skill_lv, DMG_SINGLE);
	const int32 count = limit > 0 ? map_forcountinrange(cursed_circle_bind_target, src, skill_get_splash(getSkillId(), skill_lv), limit,
		BL_CHAR, src, getSkillId(), skill_lv, binding_rate) : 0;
	if (sd)
		pc_delspiritball(sd, count, 0);
	clif_skill_nodamage(src, *src, getSkillId(), skill_lv, count > 0 && sc_start2(src, src, SC_CURSEDCIRCLE_ATKER, 100, skill_lv, count, skill_get_time(getSkillId(), skill_lv)));
}
