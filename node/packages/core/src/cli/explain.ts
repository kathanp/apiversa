import { loadBundle, planFor } from '../bundle/load.js';
import { execute } from '../chain/run.js';

/**
 * Print the conversion chain for one route and a before/after sample.
 * The sample is a local object. Nothing is sent.
 */
export function explain(dir: string, version: string, route: string, today?: string): string {
  const bundle = loadBundle(dir, { today });
  const [method, path] = route.split(/\s+/, 2);
  const steps = planFor(bundle, version, 'up');
  const lines = [`${method ?? 'GET'} ${path ?? '/'} at ${version}`, ''];
  if (steps.length === 0) lines.push('_No changes._');
  for (const step of steps) lines.push(`- ${step.version}.${step.id} ${step.op.op}`);
  const before = { sample: true };
  const after = execute(bundle, { version, body: before, method, path, trace: false }, 'up').body;
  lines.push('', 'before: {"sample":true}', `after: ${JSON.stringify(after)}`);
  return lines.join('\n');
}
