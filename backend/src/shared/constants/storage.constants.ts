/**
 * Database and Storage Keys Constants
 */

// In-Memory Store Namespaces
export const STORAGE_IDENTITIES = 'identities';
export const STORAGE_OAUTH_ACCOUNTS = 'oauth_accounts';
export const STORAGE_USER_PROFILES = 'user_profiles';
export const STORAGE_VIDEOS = 'videos';

// Session Storage
export const SESSION_KEY_PREFIX = 'session:';
export const SESSION_TTL_DEFAULT = 86400; // 24 hours in seconds

// State Store Configuration
export const STATE_KEY_PREFIX = 'oauth_state:';
export const STATE_TTL_SECONDS = 10 * 60; // 10 minutes
export const STATE_TTL_MS = STATE_TTL_SECONDS * 1000;
