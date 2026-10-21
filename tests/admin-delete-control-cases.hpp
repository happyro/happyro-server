int main() {
 map_session_data player;
 session = &player;
 int status = 0;
 nlohmann::json result;
 command(150000,status,result);
 assert(status == 200 && mutations == 1);
 admin_delete_fence(1);
 assert(disconnects == 1 && acknowledgements == 0 && !player.state.keepshop);
 // EOF does not immediately destroy the session; queued commands must be refused.
 command(150000,status,result);
 assert(status == 409 && result["error"]["code"] == "account_deleting" && mutations == 1);
 active = false;
 admin_delete_fence(1);
 assert(quits == 1 && acknowledgements == 0);
 session = nullptr;
 saving = true;
 admin_delete_fence(1);
 assert(acknowledgements == 0);
 saving = false;
 admin_delete_fence(1);
 assert(acknowledgements == 1 && ackAccount == packetAccount && ackNonce == packetNonce && ackOpcode == 0x2b2c);
 command(150000,status,result);
 assert(status == 409 && result["error"]["code"] == "character_offline" && mutations == 1);
}
