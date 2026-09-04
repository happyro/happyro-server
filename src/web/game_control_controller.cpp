// Copyright (c) rAthena Dev Teams - Licensed under GNU GPL
// For more information, see LICENCE in the main folder

#include "game_control_controller.hpp"

#include <string>
#include <cstdlib>

#include <nlohmann/json.hpp>

#include <common/showmsg.hpp>

#include "web.hpp"

#ifndef _WIN32
#include <sys/socket.h>
#include <sys/un.h>
#include <sys/time.h>
#include <unistd.h>
#endif

namespace {
constexpr size_t MINIMUM_SECRET_LENGTH = 32;

void json_response(Response& response, int32 status, const nlohmann::json& body) {
	response.status = status;
	response.set_header("Cache-Control", "no-store");
	response.set_content(body.dump(), "application/json");
}

bool constant_time_equals(const std::string& expected, const std::string& actual) {
	size_t difference = expected.size() ^ actual.size();
	const size_t length = expected.size() > actual.size() ? expected.size() : actual.size();

	for (size_t index = 0; index < length; ++index) {
		const unsigned char expected_byte = index < expected.size() ? expected[index] : 0;
		const unsigned char actual_byte = index < actual.size() ? actual[index] : 0;
		difference |= expected_byte ^ actual_byte;
	}

	return difference == 0;
}

bool is_loopback_bind_address(const std::string& address) {
	return address == "127.0.0.1" || address == "::1" || address == "localhost";
}

bool is_authorized(const Request& request) {
	const std::string authorization = request.get_header_value("Authorization");
	const std::string prefix = "Bearer ";

	if (authorization.compare(0, prefix.size(), prefix) != 0) {
		return false;
	}

	return constant_time_equals(web_config.game_control_secret, authorization.substr(prefix.size()));
}

bool has_valid_command_envelope(const nlohmann::json& body) {
	if (!body.is_object() || !body.contains("id") || !body.contains("type") || !body.contains("payload")) {
		return false;
	}

	return body["id"].is_string() && body["id"].get_ref<const std::string&>().size() <= 64
		&& body["type"].is_string() && body["type"].get_ref<const std::string&>().size() <= 64
		&& body["payload"].is_object();
}

bool forward_to_map_server(const std::string& request_body, int& status, std::string& response_body) {
#ifdef _WIN32
	(void)request_body;
	(void)status;
	(void)response_body;
	return false;
#else
	if (web_config.game_control_socket.empty())
		return false;
	const int fd = socket(AF_UNIX, SOCK_STREAM, 0);
	if (fd < 0)
		return false;
	sockaddr_un address{};
	address.sun_family = AF_UNIX;
	if (web_config.game_control_socket.size() >= sizeof(address.sun_path)) {
		close(fd);
		return false;
	}
	std::strncpy(address.sun_path, web_config.game_control_socket.c_str(), sizeof(address.sun_path) - 1);
	if (connect(fd, reinterpret_cast<sockaddr*>(&address), sizeof(address)) < 0) {
		close(fd);
		return false;
	}
	timeval timeout{3, 0};
	setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &timeout, sizeof(timeout));
	setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
	const char* data = request_body.data();
	size_t remaining = request_body.size();
	while (remaining > 0) {
		const ssize_t sent = send(fd, data, remaining, MSG_NOSIGNAL);
		if (sent <= 0) {
			close(fd);
			return false;
		}
		data += sent;
		remaining -= static_cast<size_t>(sent);
	}
	shutdown(fd, SHUT_WR);
	response_body.clear();
	char buffer[4096];
	ssize_t count;
	while ((count = recv(fd, buffer, sizeof(buffer), 0)) > 0 && response_body.size() <= 65536)
		response_body.append(buffer, static_cast<size_t>(count));
	close(fd);
	const size_t separator = response_body.find('\n');
	if (separator == std::string::npos || separator == 0)
		return false;
	char* end = nullptr;
	status = static_cast<int>(std::strtol(response_body.c_str(), &end, 10));
	if (end != response_body.c_str() + separator || status < 100 || status > 599)
		return false;
	response_body.erase(0, separator + 1);
	if (!response_body.empty() && response_body.back() == '\n')
		response_body.pop_back();
	return true;
#endif
}
}

bool game_control_config_is_valid() {
	if (!web_config.game_control_enabled) {
		return true;
	}

	if (!is_loopback_bind_address(web_config.web_ip)) {
		ShowError("Game Control requires the web-server to bind to a loopback address.\n");
		return false;
	}

	if (web_config.game_control_secret.size() < MINIMUM_SECRET_LENGTH) {
		ShowError("Game Control requires a secret containing at least %zu bytes.\n", MINIMUM_SECRET_LENGTH);
		return false;
	}

	if (web_config.game_control_socket.empty()) {
		ShowError("Game Control requires a map-server Unix Socket path.\n");
		return false;
	}

	return true;
}

HANDLER_FUNC(game_control_capabilities) {
	if (!web_config.game_control_enabled) {
		json_response(res, 404, {{"error", {{"code", "not_found"}, {"message", "Resource not found."}}}});
		return;
	}

	if (!is_authorized(req)) {
		res.set_header("WWW-Authenticate", "Bearer");
		json_response(res, 401, {{"error", {{"code", "unauthorized"}, {"message", "Authentication is required."}}}});
		return;
	}

	int status = HTTP_SERVICE_UNAVAILABLE;
	std::string response_body;
	const std::string request_body = R"({"id":"capabilities","type":"capabilities","target":{"type":"server","id":"primary"},"payload":{}})";
	if (!forward_to_map_server(request_body, status, response_body)) {
		json_response(res, HTTP_SERVICE_UNAVAILABLE, {{"error", {{"code", "map_server_unavailable"}, {"message", "Map server is unavailable."}}}});
		return;
	}
	try {
		json_response(res, status, nlohmann::json::parse(response_body));
	} catch (const nlohmann::json::parse_error&) {
		json_response(res, HTTP_SERVICE_UNAVAILABLE, {{"error", {{"code", "invalid_map_response"}, {"message", "Map server returned an invalid response."}}}});
	}
}

HANDLER_FUNC(game_control_command) {
	if (!web_config.game_control_enabled) {
		json_response(res, HTTP_NOT_FOUND, {{"error", {{"code", "not_found"}, {"message", "Resource not found."}}}});
		return;
	}

	if (!is_authorized(req)) {
		res.set_header("WWW-Authenticate", "Bearer");
		json_response(res, 401, {{"error", {{"code", "unauthorized"}, {"message", "Authentication is required."}}}});
		return;
	}

	nlohmann::json body;
	try {
		body = nlohmann::json::parse(req.body);
	} catch (const nlohmann::json::parse_error&) {
		json_response(res, HTTP_BAD_REQUEST, {{"error", {{"code", "invalid_json"}, {"message", "Request body is not valid JSON."}}}});
		return;
	}

	if (!has_valid_command_envelope(body)) {
		json_response(res, HTTP_BAD_REQUEST, {{"error", {{"code", "invalid_command"}, {"message", "Command envelope is invalid."}}}});
		return;
	}

	int status = HTTP_SERVICE_UNAVAILABLE;
	std::string response_body;
	if (!forward_to_map_server(req.body, status, response_body)) {
		json_response(res, HTTP_SERVICE_UNAVAILABLE, {{"error", {{"code", "map_server_unavailable"}, {"message", "Map server is unavailable."}}}});
		return;
	}
	try {
		json_response(res, status, nlohmann::json::parse(response_body));
	} catch (const nlohmann::json::parse_error&) {
		json_response(res, HTTP_SERVICE_UNAVAILABLE, {{"error", {{"code", "invalid_map_response"}, {"message", "Map server returned an invalid response."}}}});
	}
}

HANDLER_FUNC(game_control_battle_config) {
	if (!web_config.game_control_enabled) {
		json_response(res, HTTP_NOT_FOUND, {{"error", {{"code", "not_found"}, {"message", "Resource not found."}}}});
		return;
	}
	if (!is_authorized(req)) {
		res.set_header("WWW-Authenticate", "Bearer");
		json_response(res, 401, {{"error", {{"code", "unauthorized"}, {"message", "Authentication is required."}}}});
		return;
	}
	int status = HTTP_SERVICE_UNAVAILABLE;
	std::string response_body;
	const std::string request_body = R"({"id":"battle-config-read","type":"battle_config.read","target":{"type":"server","id":"primary"},"payload":{}})";
	if (!forward_to_map_server(request_body, status, response_body)) {
		json_response(res, HTTP_SERVICE_UNAVAILABLE, {{"error", {{"code", "map_server_unavailable"}, {"message", "Map server is unavailable."}}}});
		return;
	}
	try {
		json_response(res, status, nlohmann::json::parse(response_body));
	} catch (const nlohmann::json::parse_error&) {
		json_response(res, HTTP_SERVICE_UNAVAILABLE, {{"error", {{"code", "invalid_map_response"}, {"message", "Map server returned an invalid response."}}}});
	}
}
