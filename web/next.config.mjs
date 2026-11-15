import dotenv from "dotenv";

// Share the single .env in the repo root with the agent
dotenv.config({ path: "../.env" });

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_OWNER_ID: process.env.DEFAULT_OWNER_ID || "alice",
  },
};

export default nextConfig;
