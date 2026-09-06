import { expect, it, vi } from 'vitest';
import { runWithConcurrencyLimit } from '../../src/scanner/run-with-concurrency-limit.js';

it('never runs more tasks than the given concurrency limit', async () => {
      const items = [1, 2, 3, 4, 5];
      const started: number[] = [];
      const releases: Array<() => void> = [];

      const task = (item: number) =>
            new Promise<number>((resolve) => {
                  started.push(item);
                  releases.push(() => resolve(item));
            });

      const resultPromise = runWithConcurrencyLimit(items, 2, task);

      await vi.waitFor(() => expect(started).toHaveLength(2));
      expect(started).toEqual([1, 2]);

      releases[0]();
      await vi.waitFor(() => expect(started).toHaveLength(3));
      expect(started).toEqual([1, 2, 3]);

      releases[1]();
      releases[2]();
      await vi.waitFor(() => expect(started).toHaveLength(5));

      releases[3]();
      releases[4]();

      await expect(resultPromise).resolves.toEqual([1, 2, 3, 4, 5]);
});

it('preserves result order regardless of resolution order', async () => {
      const task = (item: number) =>
            new Promise<number>((resolve) => {
                  setTimeout(() => resolve(item), item % 2 === 0 ? 0 : 5);
            });

      const result = await runWithConcurrencyLimit([1, 2, 3, 4], 2, task);

      expect(result).toEqual([1, 2, 3, 4]);
});

it('returns an empty array for an empty input', async () => {
      const result = await runWithConcurrencyLimit([] as number[], 3, async (x) => x);

      expect(result).toEqual([]);
});
