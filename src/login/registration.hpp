#ifndef HAPPYRO_REGISTRATION_HPP
#define HAPPYRO_REGISTRATION_HPP

// HappyRO registration errors carried by the existing AC_REFUSE_LOGIN packet.
// Keep in sync with Client src/Engine/Auth/RegistrationValidation.js.
enum RegistrationError {
	REGISTRATION_ACCOUNT_TOO_SHORT = 200,
	REGISTRATION_PASSWORD_TOO_SHORT = 201,
	REGISTRATION_ACCOUNT_EXISTS = 202,
	REGISTRATION_RATE_LIMITED = 203,
	REGISTRATION_STORAGE_FAILED = 204,
	REGISTRATION_DISABLED = 205,
	REGISTRATION_ENCRYPTION_UNSUPPORTED = 206,
	REGISTRATION_INVALID_SEX = 207,
};

inline const char* registration_error_message(int error) {
	switch (error) {
		case REGISTRATION_ACCOUNT_TOO_SHORT: return "Registration account name too short";
		case REGISTRATION_PASSWORD_TOO_SHORT: return "Registration password too short";
		case REGISTRATION_ACCOUNT_EXISTS: return "Registration account already exists";
		case REGISTRATION_RATE_LIMITED: return "Registration rate limit exceeded";
		case REGISTRATION_STORAGE_FAILED: return "Registration account storage failed";
		case REGISTRATION_DISABLED: return "Automatic registration disabled";
		case REGISTRATION_ENCRYPTION_UNSUPPORTED: return "Registration password encryption unsupported";
		case REGISTRATION_INVALID_SEX: return "Registration sex invalid";
		default: return nullptr;
	}
}
#endif
