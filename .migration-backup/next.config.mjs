/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable filesystem polling for Replit's containerized environment.
  // Without this, hot reload doesn't detect file changes on Replit.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

export default nextConfig;
