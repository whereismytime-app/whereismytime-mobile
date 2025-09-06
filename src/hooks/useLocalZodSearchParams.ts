import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { isDeepEqual } from 'remeda';

export function useLocalZodSearchParams<T extends z.ZodType>(schema: T) {
  const searchParams = useLocalSearchParams();
  const [params, setParams] = useState<z.infer<T> | null>(null);
  const [error, setError] = useState<z.ZodError | null>(null);

  // Store previous search params to compare
  // Unfortunately, useLocalSearchParams seems to trigger a re-render every time.
  // So we have to keep track of the previous search params ourselves to prevent infinite useEffect calls
  const prevSearchParamsRef = useRef<any>({});

  useEffect(() => {
    if (isDeepEqual(prevSearchParamsRef.current, searchParams)) {
      return;
    }

    prevSearchParamsRef.current = searchParams;
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
