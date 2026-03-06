/**
 * Postinstall script — prompts login for global CLI installs.
 * Silently exits for local/project installs or non-interactive environments.
 */

// Only run for global installs in an interactive terminal
if (
  process.env.npm_config_global !== 'true' ||
  !process.stderr.isTTY ||
  !process.stdin.isTTY
) {
  process.exit(0);
}

// Delegate to the CLI — with no args + no auth, it triggers the login flow
await import('./cli.js');

export {};
