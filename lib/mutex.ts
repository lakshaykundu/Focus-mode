/**
 * Serializes async operations. Each task starts only after every previously queued task has
 * settled, so concurrent popup/options/alarm events can't interleave read-modify-write cycles.
 */
export function createMutex() {
  let tail: Promise<unknown> = Promise.resolve();
  return function runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task, task);
    tail = result.catch(() => undefined);
    return result;
  };
}

export type RunExclusive = ReturnType<typeof createMutex>;
