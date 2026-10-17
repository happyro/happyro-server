int main() {
 using nlohmann::json;
 map_session_data sd;
 auto snapshot = game_control_character_appearance_snapshot(&sd);
 assert(snapshot["current"] == 0 && snapshot["reason"] == "");
 assert(snapshot["options"].size() == 4);
 assert(snapshot["options"][1]["id"] == 10 && snapshot["options"][1]["name"] == "巫师");
 for (const auto& entry : snapshot["options"]) assert(entry["fallbackOnMount"] == false && entry["mountLabel"] == "");
 auto result = game_control_character_appearance_update(&sd, {{"appearance", 10}});
 assert(result.status == 200 && result.body["data"]["result"]["characterAppearance"]["current"] == 10);
 assert(sd.appearance == 10 && sd.writes == 1 && sd.saves == 1 && sd.broadcasts == 1);
 assert(sd.status.class_ == JOB_ARCH_MAGE && sd.status.zeny == 1200);
 assert(sd.skill == 37 && sd.equipment == 1201 && sd.riding == 0 && sd.companion == 12);
 const json malformed[] = {json::object(), {{"appearance", true}}, {{"appearance", "10"}}, {{"appearance", 10.5}},
  {{"appearance", -1}}, {{"appearance", 40}}, {{"appearance", UINT64_MAX}}, {{"appearance", 4294967306LL}}, {{"appearance", 10}, {"job", 9}}};
 for (const auto& payload : malformed) assert(game_control_character_appearance_update(&sd, payload).status == 400);
 assert(game_control_character_appearance_update(&sd, {{"appearance", 7}}).status == 409);
 sd.dead = true;
 assert(game_control_character_appearance_update(&sd, {{"appearance", 0}}).body["error"]["code"] == "appearance_busy");
 assert(game_control_character_appearance_snapshot(&sd)["reason"] == "appearance_busy");
 sd.dead = false;
 for (int busy = 0; busy < 5; ++busy) {
  auto blocked_sd = sd;
  if (busy == 0) blocked_sd.npc_id = 9;
  if (busy == 1) blocked_sd.trade_partner.id = 9;
  if (busy == 2) blocked_sd.state.storage_flag = true;
  if (busy == 3) blocked_sd.state.vending = true;
  if (busy == 4) blocked_sd.state.buyingstore = true;
  assert(game_control_character_appearance_update(&blocked_sd, {{"appearance", 0}}).body["error"]["code"] == "appearance_busy");
  assert(blocked_sd.appearance == sd.appearance && blocked_sd.writes == sd.writes && blocked_sd.saves == sd.saves && blocked_sd.broadcasts == sd.broadcasts);
 }
 assert(sd.appearance == 10 && sd.writes == 1 && sd.saves == 1 && sd.broadcasts == 1);
 sd.status.class_ = JOB_TROUBADOUR; sd.appearance = 34;
 assert(game_control_character_appearance(&sd) == 34);
 sd.status.sex = SEX_FEMALE;
 game_control_character_appearance_reconcile(&sd);
 assert(sd.appearance == 0);
 sd.status.sex = SEX_MALE;
 assert(game_control_character_appearance(&sd) == 0); // Invalid selection cannot revive.
 sd.status.class_ = JOB_ARCH_MAGE; sd.appearance = 12;
 sd.status.class_ = JOB_WARLOCK;
 game_control_character_appearance_reconcile(&sd);
 assert(sd.appearance == 0); // Current-stage selection is no longer eligible.
 sd.appearance = 4294967306LL;
 game_control_character_appearance_reconcile(&sd);
 assert(sd.appearance == 0); // Never narrow before validation.
 sd.status.class_ = JOB_WINDHAWK; sd.appearance = 7; sd.riding = 1;
 snapshot = game_control_character_appearance_snapshot(&sd);
 assert(snapshot["current"] == 7 && snapshot["options"][1]["fallbackOnMount"] == true);
 assert(snapshot["options"][3]["fallbackOnMount"] == false);
 game_control_character_appearance_reconcile(&sd);
 assert(sd.appearance == 7 && sd.riding == 1 && sd.companion == 12);
 sd.status.class_ = JOB_MEISTER; sd.appearance = 19;
 snapshot = game_control_character_appearance_snapshot(&sd);
 assert(snapshot["current"] == 19 && snapshot["options"][1]["fallbackOnMount"] == true);
 sd.status.class_ = JOB_NOVICE;
 game_control_character_appearance_reconcile(&sd);
 assert(sd.appearance == 0 && game_control_character_appearance_snapshot(&sd)["options"].size() == 1);
 assert(game_control_character_appearance_update(&sd, {{"appearance", 0}}).status == 200);
 std::cout << "Appearance request/snapshot/reconciliation and gameplay isolation passed\n";
}
