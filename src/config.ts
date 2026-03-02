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

function configPaths() {
  const dir = join(homedir(), '.mindstudio');
  return { dir, file: join(dir, 'config.json') };
}

export function getConfigPath(): string {
  return configPaths().file;
}

export function loadConfig(): MindStudioConfig {
  try {
    const raw = readFileSync(configPaths().file, 'utf-8');
    return JSON.parse(raw) as MindStudioConfig;
  } catch {
    return {};
  }
}

export function saveConfig(config: MindStudioConfig): void {
  const { dir, file } = configPaths();
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export function clearConfig(): void {
  saveConfig({});
}
