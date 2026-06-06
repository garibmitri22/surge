import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from "@sentry/nextjs";

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

// Sentry wraps the build to inject the SDK + (optionally) upload source maps. Source
// map upload only runs when SENTRY_AUTH_TOKEN is present (Mitri pastes it in Vercel),
// so local/sandbox builds with no token stay green and never invoke sentry-cli.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  disableLogger: true,
});
