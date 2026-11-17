/**
 * Runs `attempt` again (up to `maxAttempts` in all) while `shouldRetry` says the
 * result is worth retrying, e.g. the line changed between reading it and calling
 * players. Returns the last result.
 */
export async function withLineRetry<T>(
  attempt: () => Promise<T>,
  shouldRetry: (result: T) => boolean,
  maxAttempts = 2
): Promise<T> {
  let result = await attempt();
  for (let i = 1; i < maxAttempts && shouldRetry(result); i++) {
    result = await attempt();
  }
  return result;
}
