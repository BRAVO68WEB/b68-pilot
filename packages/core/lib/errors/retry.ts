// packages/core/lib/errors/retry.ts
// Error handling and retry logic

export interface RetryConfig {
  maxRetries: number
  baseDelay: number      // ms
  maxDelay: number       // ms
  backoffMultiplier: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
}

export class RetryableError extends Error {
  constructor(message: string, public readonly retryable: boolean = true) {
    super(message)
    this.name = 'RetryableError'
  }
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Check if error is retryable
      if (error instanceof RetryableError && !error.retryable) {
        throw error
      }

      // Don't retry on last attempt
      if (attempt === fullConfig.maxRetries) {
        break
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        fullConfig.baseDelay * Math.pow(fullConfig.backoffMultiplier, attempt),
        fullConfig.maxDelay
      )

      console.warn(`[retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error)
      await sleep(delay)
    }
  }

  throw lastError ?? new Error('Max retries exceeded')
}

/**
 * Execute a function with timeout
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
  })

  return Promise.race([fn(), timeout])
}

/**
 * Execute multiple functions in parallel with error handling
 */
export async function parallelWithErrors<T>(
  fns: Array<() => Promise<T>>
): Promise<Array<{ result?: T; error?: Error }>> {
  const results = await Promise.allSettled(fns.map(fn => fn()))
  
  return results.map(result => {
    if (result.status === 'fulfilled') {
      return { result: result.value }
    } else {
      return { error: result.reason as Error }
    }
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
