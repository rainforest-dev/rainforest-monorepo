// Copies the shared /_shell tree (fonts, icons, shell.css) from the built library-shell into an
// app's public directory, so every app on the library hostname serves identical files at the
// same URL and the browser downloads them once. Usage: node sync-assets.mjs apps/<app>
import { cpSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const app = process.argv[2];
if (!app) throw new Error('usage: sync-assets.mjs <app dir>');

const source = join(root, 'libs/library-shell/dist/_shell');
if (!existsSync(source))
  throw new Error(`${source} is missing: build library-shell first`);

const target = join(root, app, 'public/_shell');
rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log(`synced ${source} -> ${target}`);
