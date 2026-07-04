export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
}

export class Logger {
    private readonly minLevel: LogLevel

    constructor(
        private readonly module: string,
        level: LogLevel = 'info'
    ) {
        this.minLevel = level
    }

    debug(message: string, meta?: Record<string, unknown>): void {
        this.log('debug', message, meta)
    }

    info(message: string, meta?: Record<string, unknown>): void {
        this.log('info', message, meta)
    }

    warn(message: string, meta?: Record<string, unknown>): void {
        this.log('warn', message, meta)
    }

    error(message: string, meta?: Record<string, unknown>): void {
        this.log('error', message, meta)
    }

    child(module: string): Logger {
        return new Logger(`${this.module}:${module}`, this.minLevel)
    }

    private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
        if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) return

        const entry: Record<string, unknown> = {
            level,
            time: new Date().toISOString(),
            module: this.module,
            msg: message,
            ...meta,
        }

        const line = JSON.stringify(entry)
        if (level === 'error') {
            console.error(line)
        } else if (level === 'warn') {
            console.warn(line)
        } else {
            console.log(line)
        }
    }
}

export function createLogger(module: string, level?: LogLevel): Logger {
    const envLevel = (Bun.env.B68_LOG_LEVEL ?? 'info') as LogLevel
    return new Logger(module, level ?? envLevel)
}
