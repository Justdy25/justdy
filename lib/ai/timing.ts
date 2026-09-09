export type AITimer = {
  startedAt: number;
  elapsedMs: () => number;
};

export function createAITimer(): AITimer {
  const startedAt = Date.now();

  return {
    startedAt,

    elapsedMs(): number {
      return Math.max(0, Date.now() - startedAt);
    },
  };
}

export function createAITTFTTimer(): {
  startedAt: number;
  timeToFirstTokenMs: () => number | undefined;
  markFirstToken: () => number | undefined;
} {
  const startedAt = Date.now();

  let firstTokenAt: number | undefined;

  return {
    startedAt,

    timeToFirstTokenMs(): number | undefined {
      if (firstTokenAt === undefined) {
        return undefined;
      }

      return Math.max(0, firstTokenAt - startedAt);
    },

    markFirstToken(): number | undefined {
      if (firstTokenAt !== undefined) {
        return Math.max(0, firstTokenAt - startedAt);
      }

      firstTokenAt = Date.now();

      return Math.max(0, firstTokenAt - startedAt);
    },
  };
}
