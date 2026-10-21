int main() {
 assert(login_mmo_auth_new("kuga", "secret", 'M', "127.0.0.1") == REGISTRATION_ACCOUNT_TOO_SHORT);
 assert(login_mmo_auth_new("kuga01", "12345", 'M', "127.0.0.1") == REGISTRATION_PASSWORD_TOO_SHORT);
 assert(login_mmo_auth_new("kuga01", "", 'M', "127.0.0.1") == REGISTRATION_PASSWORD_TOO_SHORT);
 assert(login_mmo_auth_new("kuga01", "secret", 'X', "127.0.0.1") == REGISTRATION_INVALID_SEX);
 exists = true;
 assert(login_mmo_auth_new("kuga01", "secret", 'M', "127.0.0.1") == REGISTRATION_ACCOUNT_EXISTS);
 exists = false; can_create = false;
 assert(login_mmo_auth_new("kuga01", "secret", 'M', "127.0.0.1") == REGISTRATION_STORAGE_FAILED);
 assert(creation_count == 1);
 can_create = true;
 login_session_data state{}; auto* sd = &state;
 std::strcpy(sd->userid,"kuga01_M"); std::strcpy(sd->passwd,"secret");
 login_config.new_account_flag = false;
 assert(registration_request(sd) == REGISTRATION_DISABLED);
 login_config.new_account_flag = true; sd->passwdenc = 1;
 assert(registration_request(sd) == REGISTRATION_ENCRYPTION_UNSUPPORTED);
 sd->passwdenc = 0; std::strcpy(sd->userid,"_M");
 assert(registration_request(sd) == REGISTRATION_ACCOUNT_TOO_SHORT);
 std::strcpy(sd->userid,"kuga01_M"); sd->passwd[0] = '\0';
 assert(registration_request(sd) == REGISTRATION_PASSWORD_TOO_SHORT);
 std::strcpy(sd->userid,"kuga01_F"); std::strcpy(sd->passwd,"secret");
 assert(registration_request(sd) == -1); assert(std::strcmp(sd->userid,"kuga01")==0);
 assert(login_mmo_auth_new("kuga02", "secret", 'M', "127.0.0.1") == REGISTRATION_RATE_LIMITED);
 // Expiry at the exact millisecond must open a new window, then enforce it.
 now += login_config.time_allowed * 1000;
 assert(login_mmo_auth_new("kuga03", "secret", 'M', "127.0.0.1") == -1);
 assert(login_mmo_auth_new("kuga04", "secret", 'M', "127.0.0.1") == REGISTRATION_RATE_LIMITED);
 for(int code=200;code<=207;code++) assert(registration_error_message(code));
 assert(registration_error_message(1)==nullptr);
 std::cout << "Registration length, duplicate, storage, disabled, encryption, empty input, success and rate-limit checks passed\n";
}
