export class Slots {
  private active = 0;
  private queue: (() => void)[] = [];
  constructor(private limit: number) {}
  async use<T>(signal: AbortSignal, fn: () => Promise<T>): Promise<T> {
    if (signal.aborted) throw new Error('任务已停止');
    if (this.active >= this.limit)
      await new Promise<void>((resolve, reject) => {
        const ready = () => {
          signal.removeEventListener('abort', abort);
          resolve();
        };

        const abort = () => {
          const i = this.queue.indexOf(ready);
          if (i >= 0) this.queue.splice(i, 1);
          reject(new Error('任务已停止'));
        };
        this.queue.push(ready);
        signal.addEventListener('abort', abort, { once: true });
      });
    else this.active++;
    try {
      if (signal.aborted) throw new Error('任务已停止');

      return await fn();
    } finally {
      const next = this.queue.shift();
      if (next) next();
      else this.active--;
    }
  }
}
