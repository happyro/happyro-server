#ifndef HAPPYRO_GAME_CONTROL_SETTINGS_STATE_HPP
#define HAPPYRO_GAME_CONTROL_SETTINGS_STATE_HPP

#include <cstdint>
#include <limits>
#include <string>
#include <utility>

// Owned by the map event loop. An instance ID changes on process restart;
// revisions prevent commands admitted before a recovery barrier from running.
class GameControlSettingsState {
public:
 enum class Admission { accepted, wrong_instance, stale_revision, invalid_request };
 explicit GameControlSettingsState(std::string instance) : instance_(std::move(instance)) {}
 const std::string& instance() const { return instance_; }
 uint64_t revision() const { return revision_; }
 const std::string& last_command() const { return last_command_; }
 const std::string& last_status() const { return last_status_; }

 Admission begin(const std::string& instance, uint64_t expected, const std::string& command) {
  if (instance != instance_) return Admission::wrong_instance;
  if (expected != revision_) return Admission::stale_revision;
  if (command.empty() || command.size() > 64 || revision_ == std::numeric_limits<uint64_t>::max())
   return Admission::invalid_request;
  ++revision_;
  last_command_ = command;
  last_status_ = "running";
  return Admission::accepted;
 }
 void complete(bool succeeded) { last_status_ = succeeded ? "succeeded" : "failed"; }
 Admission fence(const std::string& instance, uint64_t expected) {
  if (instance != instance_) return Admission::wrong_instance;
  if (expected != revision_) return Admission::stale_revision;
  if (revision_ == std::numeric_limits<uint64_t>::max()) return Admission::invalid_request;
  ++revision_;
  last_command_.clear();
  last_status_ = "fenced";
  return Admission::accepted;
 }
private:
 std::string instance_;
 uint64_t revision_ = 0;
 std::string last_command_;
 std::string last_status_ = "idle";
};
#endif
