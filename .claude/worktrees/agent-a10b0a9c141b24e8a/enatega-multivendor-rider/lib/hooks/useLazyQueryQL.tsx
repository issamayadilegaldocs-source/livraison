import {
  DocumentNode,
  LazyQueryHookOptions,
  OperationVariables,
  useLazyQuery,
} from "@apollo/client";
import { WatchQueryFetchPolicy } from "@apollo/client/core/watchQueryOptions";
import { debounce } from "lodash";
import { useCallback, useEffect, useRef } from "react";
import { retryQuery } from "@/lib/utils/methods/gloabl";

export const useLazyQueryQL = <
  T extends DocumentNode,
  V extends OperationVariables | LazyQueryHookOptions,
>(
  query: DocumentNode,
  options: {
    enabled?: boolean;
    debounceMs?: number;
    pollInterval?: number;
    fetchPolicy?: WatchQueryFetchPolicy;
    retry?: number;
    retryDelayMs?: number;
    onCompleted?: (data: NoInfer<T>) => void;
  } = {},
  variables?: V,
) => {
  const {
    enabled = true,
    debounceMs = 500,
    pollInterval,
    fetchPolicy,
    retry = 3,
    retryDelayMs = 1000,
    onCompleted,
  } = options;

  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;
  // Keep default variables in a ref so debouncedFetch can use the latest value
  // without being recreated on every render.
  const defaultVariablesRef = useRef(variables);
  defaultVariablesRef.current = variables;

  const [fetch, { data, error, loading }] = useLazyQuery<T, V>(query, {
    fetchPolicy,
    pollInterval,
  });

  // Apollo 4.0 removes onCompleted from hook options; use derived state instead.
  useEffect(() => {
    if (data) onCompletedRef.current?.(data as unknown as NoInfer<T>);
  }, [data]);

  const debouncedFetch = useCallback(
    debounce(async (callVariables?: V) => {
      // Fall back to the default variables passed at hook call-site when the
      // execute function is called without arguments.
      const merged = callVariables ?? defaultVariablesRef.current;
      return await retryQuery(() => fetch({ variables: merged }), retry, retryDelayMs);
    }, debounceMs),
    [fetch, debounceMs, retry, retryDelayMs],
  );

  const handleFetch = async (callVariables?: V) => {
    if (enabled) {
      await debouncedFetch(callVariables);
    }
  };

  return {
    data,
    error,
    loading,
    fetch: handleFetch,
    isError: !!error,
    isSuccess: !!data,
  };
};
