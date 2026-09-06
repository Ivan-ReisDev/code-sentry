import pLimit from 'p-limit';

export const runWithConcurrencyLimit = async <T, R>(
      items: readonly T[],
      concurrency: number,
      task: (item: T) => Promise<R>,
): Promise<R[]> => {
      const limit = pLimit(concurrency);
      return Promise.all(items.map((item) => limit(() => task(item))));
};
