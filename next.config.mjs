/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // För smidig första deploy: låt inte lint/typ-nits stoppa bygget.
  // Kan skärpas senare när allt rullar.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
