import { describe, expect, it } from 'vitest';
import type { RunEvent } from '../../../../../packages/contracts/index';
import { appendRunEvent, mergeRunHistory } from './run-events';

const event = (seq: number, text = ''): RunEvent => ({
  runId: 'run_a',
  seq,
  type: 'message.delta',
  agent: 'root',
  data: { text },
  createdAt: '2026-11-01T00:00:00Z',
});

describe('会话历史与 SSE 的交接', () => {
  it('异步历史补齐保留已到达的流事件，以历史覆盖同序号并按序排列', () => {
    const previous = { run_a: [event(3), event(1, 'stream')], run_b: [event(8)] };
    const merged = mergeRunHistory(previous, [['run_a', [event(1, 'history'), event(2)]]]);

    expect(merged.run_a.map((item) => item.seq)).toEqual([1, 2, 3]);
    expect(merged.run_a[0].data.text).toBe('history');
    expect(merged.run_b).toBe(previous.run_b);
    expect(previous.run_a.map((item) => item.seq)).toEqual([3, 1]);
  });

  it('重连重复事件保留原状态引用，乱序事件按 seq 追加且不修改旧数组', () => {
    const previous = { run_a: [event(1), event(3)] };
    expect(appendRunEvent(previous, 'run_a', event(3, 'duplicate'))).toBe(previous);
    const next = appendRunEvent(previous, 'run_a', event(2));

    expect(next.run_a.map((item) => item.seq)).toEqual([1, 2, 3]);
    expect(previous.run_a).toHaveLength(2);
  });
});
