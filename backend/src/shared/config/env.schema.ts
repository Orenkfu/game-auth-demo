import { z } from 'zod';

const boolFlag = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : v.toLowerCase() === 'true'));

const commaSeparatedUrls = z
  .string()
  .optional()
  .transform((raw) => {
    if (!raw) return [] as string[];
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  })
  .pipe(
    z
      .array(
        z
          .string()
          .refine((s) => {
            try {
              new URL(s);
              return true;
            } catch {
              return false;
            }
          }, 'CORS_ORIGIN entries must be valid URLs'),
      ),
  );

export const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(86400),

  CORS_ORIGIN: commaSeparatedUrls,

  OAUTH_TOKEN_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, 'OAUTH_TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)'),

  USE_REDIS: boolFlag.default(false),
  REDIS_URL: z.string().optional(),

  USE_POSTGRES: boolFlag.default(false),
  DATABASE_URL: z.string().optional(),

  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_REDIRECT_URI: z.string().url(),

  RIOT_CLIENT_ID: z.string().optional(),
  RIOT_CLIENT_SECRET: z.string().optional(),
  RIOT_REDIRECT_URI: z.string().url().optional(),

  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_PUBLIC_ENDPOINT: z.string().url().optional(),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  STORAGE_MULTIPART_THRESHOLD_MB: z.coerce.number().int().positive().optional(),
  STORAGE_PART_SIZE_MB: z.coerce.number().int().positive().optional(),
  STORAGE_URL_EXPIRY_SECS: z.coerce.number().int().positive().optional(),
  STORAGE_CDN_DOMAIN: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = result.data;

  if (env.USE_REDIS && !env.REDIS_URL) {
    throw new Error('REDIS_URL is required when USE_REDIS=true');
  }
  if (env.USE_POSTGRES && !env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required when USE_POSTGRES=true');
  }

  const placeholderMarkers = ['your_client_id', 'your_client_secret', 'your_riot_client_id'];
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === 'string' && placeholderMarkers.some((m) => v === m)) {
      throw new Error(
        `Environment variable ${k} still contains a placeholder value ("${v}"). Set a real value or leave unset.`,
      );
    }
  }

  return env;
}
