/**
 * OAuth and API Parameters Constants
 */

// Discord OAuth URLs
export const DISCORD_OAUTH_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
export const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
export const DISCORD_API_BASE_URL = 'https://discord.com/api/v10';
export const DISCORD_USER_ME_ENDPOINT = '/users/@me';

// Discord Placeholder Email
export const DISCORD_PLACEHOLDER_EMAIL_DOMAIN = '@discord.placeholder';
export const DISCORD_AVATAR_CDN_URL = 'https://cdn.discordapp.com/avatars/';

// Riot OAuth URLs
export const RIOT_OAUTH_AUTHORIZE_URL = 'https://auth.riotgames.com/authorize';
export const RIOT_TOKEN_URL = 'https://auth.riotgames.com/token';
export const RIOT_API_BASE_URL = 'https://americas.api.riotgames.com';
export const RIOT_ACCOUNT_ME_ENDPOINT = '/riot/account/v1/accounts/me';

// Riot Placeholder Email
export const RIOT_PLACEHOLDER_EMAIL_DOMAIN = '@riot.placeholder';

// OAuth Parameter Names
export const OAUTH_RESPONSE_TYPE_PARAM = 'response_type';
export const OAUTH_CODE_VALUE = 'code';
export const OAUTH_GRANT_TYPE_PARAM = 'grant_type';
export const OAUTH_GRANT_TYPE_AUTH_CODE = 'authorization_code';
export const OAUTH_GRANT_TYPE_REFRESH = 'refresh_token';
export const OAUTH_CODE_CHALLENGE_PARAM = 'code_challenge';
export const OAUTH_CODE_CHALLENGE_METHOD_PARAM = 'code_challenge_method';
export const OAUTH_CODE_CHALLENGE_METHOD_S256 = 'S256';

// HTTP Headers
export const HTTP_HEADER_CONTENT_TYPE = 'Content-Type';
export const HTTP_HEADER_AUTHORIZATION = 'Authorization';
export const CONTENT_TYPE_FORM_URLENCODED = 'application/x-www-form-urlencoded';
export const CONTENT_TYPE_JSON = 'application/json';
export const AUTH_SCHEME_BEARER = 'Bearer';
export const AUTH_SCHEME_BASIC = 'Basic';

// Hash and Encoding
export const HASH_ALGORITHM_SHA256 = 'sha256';
export const ENCODING_BASE64URL = 'base64url';

// Provider Names
export const PROVIDER_DISCORD = 'discord';
export const PROVIDER_RIOT = 'riot';

// Discord Scopes
export const DISCORD_SCOPE_IDENTIFY = 'identify';
export const DISCORD_SCOPE_EMAIL = 'email';

// Riot Scopes
export const RIOT_SCOPE_OPENID = 'openid';
export const RIOT_SCOPE_OFFLINE_ACCESS = 'offline_access';
