import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface MindStudioConfig {
  apiKey?: string;
  baseUrl?: string;
  /** @internal Last update check metadata. */
  _updateCheck?: {
    latestVersion: string;
    checkedAt: number;
  };
}

const CONFIG_DIR = join(homedir(), '.mindstudio');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function loadConfig(): MindStudioConfig {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as MindStudioConfig;
  } catch {
    return {};
  }
}

export function saveConfig(config: MindStudioConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(
    CONFIG_PATH,
    JSON.stringify(config, null, 2) + '\n',
    'utf-8',
  );
}

export function clearConfig(): void {
  saveConfig({});
}
