/**
 * Shared starting password for admin-created accounts and password resets. It is
 * shown on the login page, so every account using it must set its own password on
 * next sign-in (`must_change_password`), and it is never accepted as a chosen one.
 */
export const DEFAULT_PASSWORD = "dctech123";
