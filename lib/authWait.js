// Bounds UI waits; Supabase operations may finish later, so callers also guard attempts.
export function withAuthTimeout(operation, ms = 12000) {
  let timer;
  return Promise.race([
    Promise.resolve().then(operation),
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("This is taking too long. Please try again.")),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

export function createAuthAttempt() {
  let generation = 0;
  return {
    begin() {
      const id = ++generation;
      return () => id === generation;
    },
    invalidate() {
      generation++;
    },
  };
}
