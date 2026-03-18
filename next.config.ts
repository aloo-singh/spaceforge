import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      {
        pathname: "/images/home/editor-hero.png",
        search: "?v=20260318",
      },
    ],
  },
};

export default nextConfig;
