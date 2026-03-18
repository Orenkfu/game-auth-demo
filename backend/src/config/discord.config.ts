import { registerAs } from '@nestjs/config';

export default registerAs('discord', () => ({
  clientId: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  redirectUri: process.env.DISCORD_REDIRECT_URI,
  scopes: ['identify', 'email'],
}));
