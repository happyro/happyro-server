#ifndef HAPPYRO_SESSION_CONTROLLER_HPP
#define HAPPYRO_SESSION_CONTROLLER_HPP
#include "http.hpp"
HANDLER_FUNC(session_create);
HANDLER_FUNC(session_resume);
HANDLER_FUNC(session_revoke);
#endif
