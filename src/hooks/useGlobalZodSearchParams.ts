import { useGlobalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { z } from 'zod';

export function useGlobalZodSearchParams<T extends z.ZodType>(schema: T) {
  const searchParams = useGlobalSearchParams();
  const [params, setParams] = useState<z.infer<T>>({} as z.infer<T>);
  const [error, setError] = useState<z.ZodError | null>(null);

  useEffect(() => {
    const result = schema.safeParse(searchParams);
    if (result.success) {
      setParams(result.data);
      setError(null);
    } else {
      setError(result.error);
      // Optional: set to partial valid data or defaults
    }
  }, [searchParams, schema]);

  return { params, error, isLoading: params === null && error === null };
}
