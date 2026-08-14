#!/usr/bin/env node
process.env.NODE_ENV = "production";
import { spawn } from "node:child_process";

const port = process.env.PORT || "8080";
const child = spawn("npx", ["next", "start", "-p", port], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NODE_ENV: "production" }
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
