import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createFromRoot } from 'codama';
import { rootNodeFromAnchor } from '@codama/nodes-from-anchor';
import { renderVisitor } from '@codama/renderers-js';

const programId = 'Hq83Mc7kCATrYLwQ71e3Q7QoKBxU54iAH5hiyx8j4Gb7';
const idl = JSON.parse(readFileSync(new URL('../idl.json', import.meta.url), 'utf8'));
const root = rootNodeFromAnchor({
  ...idl,
  metadata: { ...idl.metadata, address: programId },
});
createFromRoot(root).accept(renderVisitor(fileURLToPath(new URL('./', import.meta.url))));
