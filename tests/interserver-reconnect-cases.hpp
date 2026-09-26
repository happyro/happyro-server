
int main() {
    // Startup DNS failure must preserve both configured names, including autodetection.
    configure_map("char");
    configure_char("login");
    autodetect_char();
    assert(char_ip_set);
    assert(std::string(char_ip_str) == "char");
    assert(std::string(charserv_config.login_ip_str) == "login");
    // Autodetecting our own address must not overwrite the unresolved upstream either.
    charserv_config.char_ip = 0;
    autodetect_char();
    assert(std::string(charserv_config.login_ip_str) == "login");
    assert(charserv_config.char_ip == addr_[0]);
    check_connect_char_server();
    chlogif_check_connect_logserver();
    assert(attempts.empty());

    // Recovery uses the new DNS result for both links.
    dns_address = 100;
    check_connect_char_server();
    chlogif_check_connect_logserver();
    assert((attempts == std::vector<uint32>{100, 100}));
    assert(queries[queries.size() - 2] == "char" && queries.back() == "login");

    // A failed lookup after an earlier success must not connect to the cached IP.
    dns_address = 0;
    check_connect_char_server();
    chlogif_check_connect_logserver();
    assert(attempts.size() == 2);

    // Upstream replacement is retried at its new address and can connect successfully.
    dns_address = 200;
    accept_connection = true;
    check_connect_char_server();
    chlogif_check_connect_logserver();
    assert((attempts == std::vector<uint32>{100, 100, 200, 200}));
    assert(chrif_connected && chlogif_isconnected());

    // Established links do not perform DNS lookups or reconnect.
    auto query_count = queries.size();
    dns_address = 0;
    check_connect_char_server();
    chlogif_check_connect_logserver();
    assert(queries.size() == query_count && attempts.size() == 4);

    // After an established link drops, resolve again instead of reusing its address.
    session[1] = nullptr;
    dns_address = 300;
    accept_connection = false;
    check_connect_char_server();
    chlogif_check_connect_logserver();
    assert((attempts == std::vector<uint32>{100, 100, 200, 200, 300, 300}));

    // Numeric addresses still pass through the same resolver path.
    configure_map("127.0.0.1");
    configure_char("127.0.0.1");
    check_connect_char_server();
    chlogif_check_connect_logserver();
    assert(queries[queries.size() - 2] == "127.0.0.1" && queries.back() == "127.0.0.1");
    std::cout << "PASS: startup DNS failure, recovery, changed IP, lookup failure, connected links, numeric hosts\n";
}
