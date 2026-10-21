#include <cassert>
#include <cstdarg>
#include <cstdlib>
#include <cstdint>
#include <memory>
#include <string>
#include <vector>
using uint32 = uint32_t;
using int32 = int32_t;
constexpr int SQL_ERROR=-1,SQL_SUCCESS=0;
struct mmo_charstatus { uint32 father=0,mother=0; };
struct map_session_data { mmo_charstatus status; };
int sql_handle=0;
struct {const char* char_db="char";} schema_config;
bool failed=false;
std::vector<std::string> parents;
size_t cursor=0;
int Sql_Query(int,const char*,...){cursor=0;return failed?SQL_ERROR:SQL_SUCCESS;}
void Sql_ShowDebug(int){}
int Sql_NextRow(int){return cursor<parents.size()?SQL_SUCCESS:SQL_ERROR;}
void Sql_GetData(int,int,char** output,void*){*output=parents[cursor++].data();}
void Sql_FreeResult(int){}
