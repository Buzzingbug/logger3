import { spawnSync } from "node:child_process";

// Force NODE_ENV to production during next build to prevent React 19 useContext prerender crash
const env = {
  ...process.env,
  NODE_ENV: "production"
};

const result = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  shell: true,
  env
});

process.exit(result.status ?? 0);
