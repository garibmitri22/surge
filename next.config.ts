import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Pin the workspace/Turbopack root to THIS project directory. Stray lockfiles
// in the parent folder were making Next infer the wrong root, which loaded the
// wrong .env.local (and silenced the ANTHROPIC_API_KEY). Pinning it here makes
// env loading deterministic and removes the "inferred workspace root" warning.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
