export const config = {
  backendUrl: `${process.env.BACKEND_URL ?? 'http://localhost:3001'}/api/v1`,
  ingestorUrl: process.env.INGESTOR_URL ?? 'http://localhost:3002',
  consumerUrl: process.env.CONSUMER_URL ?? 'http://localhost:3003',
};
