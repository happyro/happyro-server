#ifndef HAPPYRO_GAME_CONTROL_SETTINGS_ADMISSION_HPP
#define HAPPYRO_GAME_CONTROL_SETTINGS_ADMISSION_HPP

#include "game_control_settings_state.hpp"
#include <nlohmann/json.hpp>

inline GameControlSettingsState::Admission admit_settings_command(
 GameControlSettingsState& state, const nlohmann::json& payload, const std::string& command, bool fence = false) {
 if (!payload.is_object() || !payload.contains("instance_id") || !payload["instance_id"].is_string()
  || !payload.contains("expected_revision") || !payload["expected_revision"].is_number_unsigned())
  return GameControlSettingsState::Admission::invalid_request;
 if (fence) {
  if (payload.size() != 2) return GameControlSettingsState::Admission::invalid_request;
  return state.fence(payload["instance_id"].get_ref<const std::string&>(), payload["expected_revision"].get<uint64_t>());
 }
 return state.begin(payload["instance_id"].get_ref<const std::string&>(),
  payload["expected_revision"].get<uint64_t>(), command);
}
#endif
