import type { NextConfig } from 'next';

const config: NextConfig = {
  basePath: process.env.DEMO_BASE_PATH || '',
  // The example consumes the package's actual compiled exports.
  transpilePackages: ['next-intent'],
};
export default config;
