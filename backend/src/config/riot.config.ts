import { registerAs } from '@nestjs/config';

export default registerAs('riot', () => ({
  clientId: process.env.RIOT_CLIENT_ID,
  clientSecret: process.env.RIOT_CLIENT_SECRET,
  redirectUri: process.env.RIOT_REDIRECT_URI,
  scopes: ['openid', 'offline_access'],
}));
