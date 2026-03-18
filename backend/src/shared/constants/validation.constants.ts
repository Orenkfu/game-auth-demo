/**
 * Validation Messages and Rules Constants
 */

// Email Validation
export const EMAIL_VALIDATION_MESSAGE = 'Invalid email format';

// Password Validation
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MIN_LENGTH_MESSAGE = 'Password must be at least 12 characters';
export const PASSWORD_UPPERCASE_MESSAGE = 'Password must contain an uppercase letter';
export const PASSWORD_LOWERCASE_MESSAGE = 'Password must contain a lowercase letter';
export const PASSWORD_NUMBER_MESSAGE = 'Password must contain a number';
export const PASSWORD_SPECIAL_CHAR_MESSAGE = 'Password must contain a special character';

// Username Validation
export const USERNAME_VALIDATION_MESSAGE = 'Username can only contain letters, numbers, underscores, and hyphens';
export const USERNAME_INVALID_CHARS_REGEX = /[^a-zA-Z0-9_-]/g;
export const USERNAME_GENERATED_PREFIX = 'user_';

// Avatar Validation
export const AVATAR_URL_VALIDATION_MESSAGE = 'Invalid avatar URL';
