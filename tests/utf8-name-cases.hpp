int main() {
 for (bool by_name : {false, true}) {
  script_state state{by_name, ""};
  item_db.item = std::make_shared<item_data>();
  item_db.item->ename = "漫游舞者&宫廷乐师乐园团高级影子手套";
  assert(getitemname(&state) == SCRIPT_CMD_SUCCESS);
  assert(state.output == item_db.item->ename);
  item_db.item.reset();
  assert(getitemname(&state) == SCRIPT_CMD_SUCCESS);
  assert(state.output == "null");
 }

	// A bounded input need not include a terminator within the read limit.
	const char partial[] = {char(0xe6), char(0x9c)};
	char result[3];
	safestrncpy_utf8(result, partial, sizeof(result));
	assert(result[0] == 0);

	for (const std::string name : {"ASCII", "漫游舞者&宫廷乐师乐园团高级影子手套", "垂耳恩斯特·冯·沃尔夫 11 世（时装）", "碳酸水自动售货机#prt", "乐园团空间传送员", "测试😀商人", ""}) {
		for (size_t capacity = 0; capacity <= name.size() + 2; ++capacity) {
			char out[128]; memset(out, 0x7f, sizeof(out));
			safestrncpy_utf8(out, name.c_str(), capacity);
			assert(out[capacity] == 0x7f);
			if (!capacity) continue;
			std::string expected;
			for (size_t pos = 0; pos < name.size();) {
				unsigned char c = name[pos];
				size_t width = c < 0x80 ? 1 : c < 0xe0 ? 2 : c < 0xf0 ? 3 : 4;
				if (pos + width >= capacity) break;
				expected.append(name, pos, width); pos += width;
			}
			assert(out == expected);
			for (size_t i = expected.size(); i < capacity; ++i) assert(out[i] == 0);
		}
	}
	std::cout << "PASS UTF-8 fixed fields at every byte boundary\n";
}
