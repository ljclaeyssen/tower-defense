import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

/** Local, git-ignored files bootstrapped from a committed template when missing. */
const localFiles: ReadonlyArray<{ template: string; target: string }> = [
  {
    template: 'apps/web/src/environments/license.example.ts',
    target: 'apps/web/src/environments/license.ts',
  },
];

for (const { template, target } of localFiles) {
  const templatePath = join(workspaceRoot, template);
  const targetPath = join(workspaceRoot, target);
  if (existsSync(targetPath)) {
    continue;
  }
  copyFileSync(templatePath, targetPath);
  console.log(`[postinstall] created ${target} from ${template}`);
}
