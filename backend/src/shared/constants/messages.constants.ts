/**
 * Error Messages and Response Messages Constants
 */

// Success Messages
export const SUCCESS_ACCOUNT_CREATED = 'Account created successfully';
export const SUCCESS_LOGIN = 'Login successful';
export const SUCCESS_LOGGED_OUT = 'Logged out successfully';

// OAuth Error Messages
export const ERROR_DISCORD_AUTH_FAILED = 'Discord authorization failed';
export const ERROR_RIOT_AUTH_FAILED = 'Riot authorization failed';
export const ERROR_DISCORD_CODE_EXCHANGE = 'Failed to exchange Discord authorization code: ';
export const ERROR_DISCORD_REFRESH_TOKENS = 'Failed to refresh Discord tokens: ';
export const ERROR_DISCORD_FETCH_USER = 'Failed to fetch Discord user info: ';
export const ERROR_DISCORD_FETCH_RELATIONSHIPS = 'Failed to fetch Discord relationships: ';
export const ERROR_RIOT_CODE_EXCHANGE = 'Failed to exchange Riot authorization code: ';
export const ERROR_RIOT_REFRESH_TOKENS = 'Failed to refresh Riot tokens: ';
export const ERROR_RIOT_FETCH_ACCOUNT = 'Failed to fetch Riot account info: ';

// Session Error Messages
export const ERROR_MISSING_SESSION_TOKEN = 'Missing session token';
export const ERROR_INVALID_SESSION = 'Invalid or expired session';

// State/Validation Error Messages
export const ERROR_INVALID_OAUTH_STATE = 'Invalid or expired OAuth state';
export const ERROR_OAUTH_STATE_EXPIRED = 'OAuth state has expired';
export const ERROR_MISSING_PKCE_VERIFIER = 'Missing PKCE code verifier in state';

// Not Found Error Messages
export const ERROR_IDENTITY_NOT_FOUND = 'Identity not found';
export const ERROR_USER_NOT_FOUND = 'User not found';
export const ERROR_USER_PROFILE_NOT_FOUND = 'User profile not found';

// Link Required Exception
export const ERROR_LINK_REQUIRED_CODE = 'LINK_REQUIRED';
export const ERROR_LINK_REQUIRED_MESSAGE = 'An account with this email already exists. Please login to your existing account and link your provider from settings.';
export const ERROR_EMAIL_MASKED_PLACEHOLDER = '***';
export const ERROR_DOMAIN_MASKED_PLACEHOLDER = '***';
