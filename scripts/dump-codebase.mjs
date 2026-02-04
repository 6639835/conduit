#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      args.set(key, true);
    } else {
      args.set(key, value);
      i++;
    }
  }
  return args;
}

function isProbablyBinary(buffer) {
  const inspectLength = Math.min(buffer.length, 8192);
  for (let i = 0; i < inspectLength; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

function languageTag(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.ts':
    case '.tsx':
      return 'ts';
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'js';
    case '.json':
      return 'json';
    case '.md':
      return 'md';
    case '.css':
      return 'css';
    case '.sql':
      return 'sql';
    case '.yml':
    case '.yaml':
      return 'yaml';
    case '.toml':
      return 'toml';
    case '.sh':
      return 'sh';
    case '.txt':
    case '.env':
    default:
      return '';
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outPath = String(args.get('--out') ?? 'CODEBASE_DUMP.md');
  const maxBytes = Number(args.get('--max-bytes') ?? 2 * 1024 * 1024); // 2MB per file default
  const root = process.cwd();

  const rgCmd = [
    'rg',
    '--files',
    "-g'!.git/**'",
    "-g'!.next/**'",
    "-g'!node_modules/**'",
    "-g'!.vercel/**'",
    "-g'!dist/**'",
    "-g'!build/**'",
    "-g'!coverage/**'",
  ].join(' ');

  const files = execSync(rgCmd, { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((p) => p !== 'package-lock.json')
    .filter((p) => p !== 'tsconfig.tsbuildinfo');

  const binaryExts = new Set([
    '.ico',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.zip',
    '.gz',
    '.br',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
    '.pdf',
    '.mp4',
    '.mov',
  ]);

  const lines = [];
  lines.push('# Codebase Dump');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Root: ${root}`);
  lines.push(`Files included: ${files.length}`);
  lines.push(`Per-file max bytes: ${maxBytes}`);
  lines.push('');

  let included = 0;
  let skippedBinary = 0;
  let skippedTooLarge = 0;
  let skippedUnreadable = 0;

  for (const relPath of files) {
    const ext = path.extname(relPath).toLowerCase();
    if (binaryExts.has(ext)) {
      skippedBinary++;
      continue;
    }

    const absPath = path.join(root, relPath);
    let stat;
    try {
      stat = fs.statSync(absPath);
    } catch {
      skippedUnreadable++;
      continue;
    }
    if (!stat.isFile()) continue;

    let buffer;
    try {
      buffer = fs.readFileSync(absPath);
    } catch {
      skippedUnreadable++;
      continue;
    }

    if (isProbablyBinary(buffer)) {
      skippedBinary++;
      continue;
    }

    let truncated = false;
    if (buffer.length > maxBytes) {
      buffer = buffer.subarray(0, maxBytes);
      truncated = true;
      skippedTooLarge++;
    }

    const content = buffer.toString('utf8');
    const lang = languageTag(relPath);

    lines.push(`## ${relPath}`);
    if (truncated) lines.push(`(truncated to ${maxBytes} bytes)`);
    lines.push('');
    lines.push('```' + lang);
    lines.push(content.replace(/\n$/, ''));
    lines.push('```');
    lines.push('');
    included++;
  }

  lines.push('---');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Included: ${included}`);
  lines.push(`- Skipped (binary): ${skippedBinary}`);
  lines.push(`- Truncated (too large): ${skippedTooLarge}`);
  lines.push(`- Skipped (unreadable): ${skippedUnreadable}`);
  lines.push('');

  fs.writeFileSync(path.join(root, outPath), lines.join('\n'), 'utf8');
  process.stdout.write(`Wrote ${outPath} (included ${included} files)\n`);
}

main();
