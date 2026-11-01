import type { Report, Run } from '../contracts/index';
import { parse } from './common';
export function decodeRun(row: Record<string, unknown>): Run {
  return { ...row, snapshot: parse(row.snapshot, {}) } as unknown as Run;
}

export function decodeReport(r: Record<string, unknown>): Report {
  return { ...r, evidenceIds: parse(r.evidenceIds, []) } as unknown as Report;
}
