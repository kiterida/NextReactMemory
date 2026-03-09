const fs = require('fs');
const path = require('path');

function getCanonicalPath(inputPath) {
  const resolved = path.resolve(inputPath);
  const parsed = path.parse(resolved);
  const root = parsed.root;
  const segments = resolved.slice(root.length).split(path.sep).filter(Boolean);

  let current = root;

  for (const segment of segments) {
    const entries = fs.readdirSync(current || root);
    const actual = entries.find((entry) => entry.toLowerCase() === segment.toLowerCase());

    if (!actual) {
      return resolved;
    }

    current = path.join(current, actual);
  }

  return current;
}

const cwd = process.cwd();
const canonical = getCanonicalPath(cwd);

if (cwd !== canonical) {
  console.error(`Path casing mismatch.

Current:   ${cwd}
Expected:  ${canonical}

Start Next.js from the exact on-disk path above. On Windows, mixed casing can duplicate Next internals and break the App Router.`);
  process.exit(1);
}
