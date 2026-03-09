import { execSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import packageJson from '../../../package.json';

const VERSION_ROOTS = ['app', 'data', 'scripts'];
const VERSION_FILES = ['auth.ts', 'middleware.ts', 'next.config.mjs', 'package.json', 'theme.ts'];
const IGNORED_DIRS = new Set(['.git', '.next', '.vs', 'node_modules']);

function runGitCommand(command: string) {
  try {
    return execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function getLatestMtimeMs(targetPath: string): number {
  const stats = statSync(targetPath);

  if (stats.isFile()) {
    return stats.mtimeMs;
  }

  if (!stats.isDirectory()) {
    return 0;
  }

  let latestMtimeMs = stats.mtimeMs;

  for (const entry of readdirSync(targetPath, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    const childPath = join(targetPath, entry.name);
    latestMtimeMs = Math.max(latestMtimeMs, getLatestMtimeMs(childPath));
  }

  return latestMtimeMs;
}

function formatDirtyStamp(mtimeMs: number) {
  const timestamp = new Date(mtimeMs);
  const parts = [
    timestamp.getFullYear(),
    String(timestamp.getMonth() + 1).padStart(2, '0'),
    String(timestamp.getDate()).padStart(2, '0'),
    String(timestamp.getHours()).padStart(2, '0'),
    String(timestamp.getMinutes()).padStart(2, '0'),
    String(timestamp.getSeconds()).padStart(2, '0'),
  ];

  return `${parts[0]}${parts[1]}${parts[2]}.${parts[3]}${parts[4]}${parts[5]}`;
}

function getWorkspaceVersion() {
  const baseVersion = packageJson.version;
  const commitSha = runGitCommand('git rev-parse --short HEAD');
  const dirty = runGitCommand('git status --porcelain');

  if (!dirty) {
    return commitSha ? `v${baseVersion}+${commitSha}` : `v${baseVersion}`;
  }

  const trackedPaths = [
    ...VERSION_ROOTS.map((segment) => join(process.cwd(), segment)),
    ...VERSION_FILES.map((segment) => join(process.cwd(), segment)),
  ];

  const latestMtimeMs = trackedPaths.reduce((latest, currentPath) => {
    try {
      return Math.max(latest, getLatestMtimeMs(currentPath));
    } catch {
      return latest;
    }
  }, 0);

  return `v${baseVersion}-dev.${formatDirtyStamp(latestMtimeMs || Date.now())}`;
}

export function GET() {
  return NextResponse.json({
    version: getWorkspaceVersion(),
  });
}
