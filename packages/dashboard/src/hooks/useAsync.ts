import { useState, useEffect, useCallback } from 'react'

type AsyncState<T> = {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Generic hook for async API calls with loading/error states.
 */
export function useAsync<T>(
  asyncFn: () => Promise<T>,
  deps: unknown[] = []
): AsyncState<T> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  })

  const execute = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const data = await asyncFn()
      setState({ data, loading: false, error: null })
    } catch (error) {
      setState({ data: null, loading: false, error: String(error) })
    }
  }, deps)

  useEffect(() => {
    execute()
  }, [execute])

  return { ...state, refetch: execute }
}
