import type { Direction } from '../errors.js';
import type { JObject, JValue } from '../json/value.js';
import type { RawOp } from '../model.js';
import { evalExpr } from '../expr/eval.js';

/** Reshape an error body on the way down when the code or status matches. */
export function errorShape(root: JObject, op: RawOp, when: Direction, status: number | undefined, errorCode: string | undefined): JValue {
  if (when !== 'down') return root;
  const codeOk = op.code === undefined || op.code === errorCode;
  const statusOk = op.status === undefined || op.status === status;
  if (!codeOk || !statusOk) return root;
  if (op.code === undefined && op.status === undefined) return root;
  return evalExpr(op.down, root, when);
}
