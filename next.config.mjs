/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['msedge-tts', 'ws', 'bufferutil', 'utf-8-validate'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent webpack from bundling native Node.js modules used by ws
      const existing = Array.isArray(config.externals) ? config.externals : [];
      config.externals = [...existing, 'bufferutil', 'utf-8-validate', 'ws', 'msedge-tts'];
    }
    return config;
  },
};
export default nextConfig;
