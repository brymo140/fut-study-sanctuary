export const isSchemaCacheError = (error: unknown) => {
  const err = error as { code?: string; message?: string } | null | undefined;
  return err?.code === "PGRST002" || /schema cache/i.test(err?.message || "");
};

export const waitForSchemaRetry = () => new Promise((resolve) => setTimeout(resolve, 1500));

export const withSchemaRetry = async <T extends { error: unknown }>(operation: () => Promise<T>): Promise<T> => {
  try {
    let result = await operation();
    if (isSchemaCacheError(result.error)) {
      await waitForSchemaRetry();
      result = await operation();
    }
    return result;
  } catch (error) {
    if (isSchemaCacheError(error)) {
      await waitForSchemaRetry();
      return operation();
    }
    throw error;
  }
};

export const getDatabaseErrorMessage = (error: unknown, fallback = "Database request failed") => {
  const err = error as { message?: string } | null | undefined;
  return err?.message || fallback;
};