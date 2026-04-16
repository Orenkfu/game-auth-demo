import type IForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import webpack from 'webpack';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

export const plugins = [
  new ForkTsCheckerWebpackPlugin({
    logger: 'webpack-infrastructure',
  }),
  new webpack.DefinePlugin({
    'process.env.BACKEND_URL': JSON.stringify(process.env.BACKEND_URL ?? 'http://localhost:3001'),
    'process.env.INGESTOR_URL': JSON.stringify(process.env.INGESTOR_URL ?? 'http://localhost:3002'),
    'process.env.CONSUMER_URL': JSON.stringify(process.env.CONSUMER_URL ?? 'http://localhost:3003'),
  }),
];
