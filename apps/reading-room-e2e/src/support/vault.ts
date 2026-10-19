import fs from 'node:fs';
import path from 'node:path';

import {
  readingQueueJson,
  sourceRegistryMarkdown,
  topicRegistryMarkdown,
} from './fixture-vault';

export const VAULT_DIR = path.join(
  __dirname,
  '..',
  '..',
  'test-output',
  'vault',
);

export const SOURCES_FILE = 'RSS-Source-Registry.md';
export const TOPICS_FILE = 'RSS-Topic-Registry.md';
export const QUEUE_FILE = 'reading-queue.json';

export type VaultFile =
  typeof SOURCES_FILE | typeof TOPICS_FILE | typeof QUEUE_FILE;

const filePath = (file: VaultFile): string => path.join(VAULT_DIR, file);

export function resetVault(): void {
  fs.rmSync(VAULT_DIR, { recursive: true, force: true });
  fs.mkdirSync(VAULT_DIR, { recursive: true });
  fs.writeFileSync(filePath(SOURCES_FILE), sourceRegistryMarkdown(), 'utf-8');
  fs.writeFileSync(filePath(TOPICS_FILE), topicRegistryMarkdown(), 'utf-8');
  fs.writeFileSync(filePath(QUEUE_FILE), readingQueueJson(), 'utf-8');
}

export function readVault(file: VaultFile): string {
  return fs.readFileSync(filePath(file), 'utf-8');
}

export function makeReadOnly(file: VaultFile): void {
  fs.chmodSync(filePath(file), 0o444);
}

export function removeFile(file: VaultFile): void {
  fs.rmSync(filePath(file));
}

export function writeVaultFile(file: VaultFile, content: string): void {
  fs.writeFileSync(filePath(file), content, 'utf-8');
}

export const canDropWritePermission = process.getuid?.() !== 0;
