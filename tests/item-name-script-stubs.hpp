#include <memory>
struct item_data { std::string ename; };
struct script_state { bool by_name; std::string output; };
struct TestItemDatabase {
 std::shared_ptr<item_data> item;
 std::shared_ptr<item_data> searchname(const char*) { return item; }
 std::shared_ptr<item_data> find(int) { return item; }
} item_db;
#define BUILDIN_FUNC(name) int name(script_state* st)
constexpr int SCRIPT_CMD_SUCCESS = 0;
bool script_isstring(script_state* st, int) { return st->by_name; }
const char* script_getstr(script_state*, int) { return "S_2Para_WM_Weapon"; }
int script_getnum(script_state*, int) { return 24709; }
void script_pushconststr(script_state* st, const char* value) { st->output = value; }
void script_pushstrcopy(script_state* st, const char* value) { st->output = value; }
