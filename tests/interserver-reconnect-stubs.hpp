#include <cassert>
#include <cstdint>
#include <cstring>
#include <cstdio>
#include <iostream>
#include <string>
#include <vector>
#include <arpa/inet.h>
using int32 = int32_t;
using uint32 = uint32_t;
#define TIMER_FUNC(name) int name()
#define CL_WHITE ""
#define CL_RESET ""
#define ShowWarning(...) ((void)0)
#define ShowInfo(...) ((void)0)
#define ShowStatus(...) ((void)0)
void safestrncpy(char* out, const char* in, size_t n) { std::snprintf(out, n, "%s", in); }
uint32 dns_address = 0;
std::vector<std::string> queries;
std::vector<uint32> attempts;
uint32 host2ip(const char* name) { queries.emplace_back(name); return dns_address; }
const char* ip2str(uint32 ip, char* out) { std::snprintf(out, 16, "%u", ip); return out; }
uint32 str2ip(const char* ip) { return std::stoul(ip); }
struct Session { void (*func_parse)(); struct { int server; } flag; } connection;
Session* session[4] = {};
bool accept_connection = false;
int make_connection(uint32 ip, int, bool, int) {
    attempts.push_back(ip);
    if (!accept_connection) return -1;
    session[1] = &connection;
    return 1;
}
void chrif_parse() {}
void chlogif_parse() {}
void realloc_fifo(int, int, int) {}
constexpr int FIFOSIZE_SERVERLINK = 1024;
int char_fd = -1, char_port = 6121, chrif_state = 0, chrif_connected = 0, char_ip_set = 0;
uint32 char_ip = 0;
char char_ip_str[128] = {};
void chrif_connect(int) { chrif_state = 2; }
bool chrif_isconnected() { return chrif_state == 2; }
int login_fd = 0;
bool chlogif_isconnected() { return login_fd > 0 && session[login_fd]; }
struct {
    uint32 login_ip = 0, char_ip = 99;
    char login_ip_str[128] = {}, char_ip_str[128] = {};
    int login_port = 6900, char_port = 6121, char_maintenance = 0, char_new_display = 0;
    char userid[24] = {}, passwd[24] = {}, server_name[20] = {};
} charserv_config;
uint32 addr_[] = {42};
int naddr_ = 1;
char packet[86];
uint16_t packet_word;
uint32 packet_long;
#define WFIFOHEAD(...) ((void)0)
#define WFIFOW(...) packet_word
#define WFIFOL(...) packet_long
#define WFIFOP(fd, offset) (packet + offset)
#define WFIFOSET(...) ((void)0)
