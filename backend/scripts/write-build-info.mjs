import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const outputPath = resolve(process.cwd(), 'src/generated/buildInfo.ts');
const buildTimeIso = new Date().toISOString();

const fileContent = `export const BACKEND_BUILD_TIME_ISO = '${buildTimeIso}';\n`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, fileContent, 'utf8');

console.log(`Wrote backend build info to ${outputPath}`);
