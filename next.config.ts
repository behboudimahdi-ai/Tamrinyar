import type { NextConfig } from 'next';
const config: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: '51mb' } },
};
export default config;