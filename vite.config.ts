import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

async function filesUnder(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(path, entry.name);
      return entry.isDirectory() ? filesUnder(fullPath) : [fullPath];
    })
  );
  return nested.flat();
}

function precacheBuiltApp() {
  return {
    name: 'splitsmart-precache-built-app',
    apply: 'build' as const,
    async closeBundle() {
      const dist = join(process.cwd(), 'dist');
      const assets = (await filesUnder(join(dist, 'assets')))
        .filter((file) => /\.(js|css|svg|png|webp|woff2?)$/i.test(file))
        .map((file) => `/${relative(dist, file).replaceAll('\\', '/')}`)
        .sort();
      const workerPath = join(dist, 'sw.js');
      const source = await readFile(workerPath, 'utf8');
      const hash = createHash('sha256');
      for (const file of (await filesUnder(dist)).sort()) {
        hash.update(relative(dist, file));
        hash.update(await readFile(file));
      }
      const buildId = hash.digest('hex').slice(0, 12);
      const output = source
        .replace('__BUILD_ID__', buildId)
        .replace(
          '/* BUILD_ASSETS */',
          assets.map((asset) => `${JSON.stringify(asset)},`).join('\n  ')
        );
      await writeFile(workerPath, output);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), precacheBuiltApp()],
  server: {
    host: true,
    port: 5173,
  },
});
