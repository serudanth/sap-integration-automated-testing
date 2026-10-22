import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import pc from 'picocolors';
import { maskHeaders, maskUrl, sanitizeForLogging } from '../config/index.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export const LOG_LEVEL_PRIORITIES: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50
};

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module?: string;
  message: string;
  data?: any;
}

export interface LoggerOptions {
  level?: LogLevel;
  fileLevel?: LogLevel;
  logFile?: string | false;
  enableConsole?: boolean;
  enableFile?: boolean;
  timestamp?: boolean;
  colorize?: boolean;
  context?: Record<string, any>;
  customWriter?: (entry: LogEntry, formattedConsole: string, formattedFile: string) => void;
}

export interface HttpRequestLogOptions {
  method?: string;
  url: string;
  headers?: Record<string, any>;
  body?: string | Buffer | any;
  timeoutMs?: number;
}

export interface HttpResponseLogOptions {
  statusCode: number;
  durationMs: number;
  headers?: Record<string, any>;
  body?: string;
  messageId?: string;
  isSoapFault?: boolean;
  soapFaultDetails?: {
    faultCode?: string;
    faultString?: string;
    detail?: string;
  };
}

interface LoggerConfig {
  level: LogLevel;
  fileLevel: LogLevel;
  logFile?: string | false;
  enableConsole: boolean;
  enableFile: boolean;
  timestamp: boolean;
  colorize: boolean;
  customWriter?: (entry: LogEntry, formattedConsole: string, formattedFile: string) => void;
}

export class Logger {
  private config: LoggerConfig;
  private levelOverride?: LogLevel;
  private context: Record<string, any>;

  constructor(options: LoggerOptions = {}, sharedConfig?: LoggerConfig) {
    const isTestEnv = typeof process !== 'undefined' && Boolean(process.env.VITEST);

    if (sharedConfig) {
      this.config = sharedConfig;
      this.levelOverride = options.level;
    } else {
      const defaultLogFile = isTestEnv ? false : (process.env.AETHERFLOW_LOG_FILE || 'logs/aetherflow.log');
      const logFile = options.logFile !== undefined ? options.logFile : defaultLogFile;
      this.config = {
        level: options.level ?? (isTestEnv ? 'silent' : (process.env.AETHERFLOW_LOG_LEVEL as LogLevel) || 'warn'),
        fileLevel: options.fileLevel ?? (isTestEnv ? 'silent' : (process.env.AETHERFLOW_FILE_LOG_LEVEL as LogLevel) || 'debug'),
        logFile,
        enableConsole: options.enableConsole ?? (isTestEnv ? false : true),
        enableFile: options.enableFile ?? (isTestEnv ? false : Boolean(logFile)),
        timestamp: options.timestamp ?? true,
        colorize: options.colorize ?? true,
        customWriter: options.customWriter
      };
      this.levelOverride = undefined;
    }

    this.context = { ...(options.context || {}) };
  }

  public setLevel(level: LogLevel): void {
    if (this.levelOverride !== undefined) {
      this.levelOverride = level;
    } else {
      this.config.level = level;
    }
  }

  public getLevel(): LogLevel {
    return this.levelOverride ?? this.config.level;
  }

  public setFileLevel(level: LogLevel): void {
    this.config.fileLevel = level;
  }

  public getFileLevel(): LogLevel {
    return this.config.fileLevel;
  }

  public setLogFile(logFile: string | false): void {
    this.config.logFile = logFile;
    this.config.enableFile = Boolean(logFile);
  }

  public getLogFile(): string | false | undefined {
    return this.config.logFile;
  }

  public configure(options: Partial<LoggerOptions>): void {
    if (options.level !== undefined) {
      this.config.level = options.level;
      this.levelOverride = undefined;
    }
    if (options.fileLevel !== undefined) this.config.fileLevel = options.fileLevel;
    if (options.logFile !== undefined) {
      this.config.logFile = options.logFile;
      this.config.enableFile = Boolean(options.logFile);
    }
    if (options.enableConsole !== undefined) this.config.enableConsole = options.enableConsole;
    if (options.enableFile !== undefined) this.config.enableFile = options.enableFile;
    if (options.timestamp !== undefined) this.config.timestamp = options.timestamp;
    if (options.colorize !== undefined) this.config.colorize = options.colorize;
    if (options.customWriter !== undefined) this.config.customWriter = options.customWriter;
    if (options.context !== undefined) {
      this.context = { ...this.context, ...options.context };
    }
  }

  public child(context: Record<string, any>): Logger {
    return new Logger(
      {
        context: { ...this.context, ...context }
      },
      this.config
    );
  }

  public debug(message: string, data?: any): void {
    this.write('debug', message, data);
  }

  public info(message: string, data?: any): void {
    this.write('info', message, data);
  }

  public warn(message: string, data?: any): void {
    this.write('warn', message, data);
  }

  public error(message: string, data?: any): void {
    this.write('error', message, data);
  }

  /**
   * Logs an outgoing HTTP request with automated URL and header redaction.
   */
  public logRequest(options: HttpRequestLogOptions, _hostConfig?: any): void {
    const method = (options.method || 'POST').toUpperCase();
    const masked = maskUrl(options.url);
    const timeoutStr = options.timeoutMs ? ` (timeout: ${options.timeoutMs}ms)` : '';
    this.info(`--> ${method} ${masked}${timeoutStr}`);

    if (options.headers && Object.keys(options.headers).length > 0) {
      this.debug(`--> Request Headers:`, maskHeaders(options.headers));
    }

    if (options.body) {
      const bodyStr = Buffer.isBuffer(options.body)
        ? options.body.toString('utf-8')
        : (typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      const snippet = bodyStr.length > 2000
        ? `${bodyStr.slice(0, 2000)}... [truncated ${bodyStr.length - 2000} bytes]`
        : bodyStr;
      this.debug(`--> Request Body (${bodyStr.length} bytes):`, snippet);
    }
  }

  /**
   * Logs an incoming HTTP response with status, latency, messageId, and SOAP fault decoding.
   */
  public logResponse(response: HttpResponseLogOptions, url?: string): void {
    const masked = url ? ` ${maskUrl(url)}` : '';
    if (response.isSoapFault) {
      const faultCode = response.soapFaultDetails?.faultCode ? ` [${response.soapFaultDetails.faultCode}]` : '';
      const faultStr = response.soapFaultDetails?.faultString || 'Unknown Fault';
      this.warn(`<-- ${response.statusCode}${masked} [${response.durationMs}ms] SOAP Fault${faultCode}: ${faultStr}`);
      if (response.soapFaultDetails?.detail) {
        this.debug(`<-- SOAP Fault Detail:`, response.soapFaultDetails.detail);
      }
    } else if (response.statusCode >= 400) {
      this.error(`<-- ${response.statusCode}${masked} [${response.durationMs}ms] HTTP Error`);
    } else {
      const msgId = response.messageId ? ` (MessageID: ${response.messageId})` : '';
      this.info(`<-- ${response.statusCode}${masked} [${response.durationMs}ms]${msgId}`);
    }

    if (response.headers && Object.keys(response.headers).length > 0) {
      this.debug(`<-- Response Headers:`, maskHeaders(response.headers));
    }

    if (response.body) {
      const bodyStr = typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
      const snippet = bodyStr.length > 2000
        ? `${bodyStr.slice(0, 2000)}... [truncated ${bodyStr.length - 2000} bytes]`
        : bodyStr;
      this.debug(`--> Response Body (${bodyStr.length} bytes):`, snippet);
    }
  }

  private write(level: LogLevel, message: string, data?: any): void {
    const isConsoleAllowed = this.config.enableConsole && LOG_LEVEL_PRIORITIES[level] >= LOG_LEVEL_PRIORITIES[this.getLevel()];
    const isFileAllowed = this.config.enableFile && Boolean(this.config.logFile) && LOG_LEVEL_PRIORITIES[level] >= LOG_LEVEL_PRIORITIES[this.config.fileLevel];
    const isCustomAllowed = Boolean(this.config.customWriter) && (LOG_LEVEL_PRIORITIES[level] >= LOG_LEVEL_PRIORITIES[this.getLevel()] || isFileAllowed);

    if (!isConsoleAllowed && !isFileAllowed && !isCustomAllowed) {
      return;
    }

    const timestamp = new Date().toISOString();
    const moduleName = this.context.module;
    const sanitizedData = data !== undefined ? (data instanceof Error ? data : sanitizeForLogging(data)) : undefined;

    const entry: LogEntry = {
      timestamp,
      level,
      module: moduleName,
      message,
      data: sanitizedData
    };

    const formattedConsole = this.formatConsole(entry);
    const formattedFile = this.formatFile(entry);

    if (isCustomAllowed && this.config.customWriter) {
      this.config.customWriter(entry, formattedConsole, formattedFile);
    }

    if (isConsoleAllowed) {
      if (level === 'error') {
        console.error(formattedConsole);
      } else if (level === 'warn') {
        console.warn(formattedConsole);
      } else {
        console.log(formattedConsole);
      }
    }

    if (isFileAllowed && this.config.logFile) {
      try {
        const filePath = resolve(process.cwd(), this.config.logFile);
        const dir = dirname(filePath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        appendFileSync(filePath, formattedFile + '\n', 'utf-8');
      } catch {
        // Prevent logger I/O failures from interrupting test runtime
      }
    }
  }

  private formatConsole(entry: LogEntry): string {
    const parts: string[] = [];

    if (this.config.timestamp) {
      parts.push(this.config.colorize ? pc.dim(entry.timestamp) : entry.timestamp);
    }

    let badge = `[${entry.level.toUpperCase()}]`;
    if (this.config.colorize) {
      switch (entry.level) {
        case 'debug':
          badge = pc.magenta(badge);
          break;
        case 'info':
          badge = pc.blue(badge);
          break;
        case 'warn':
          badge = pc.yellow(badge);
          break;
        case 'error':
          badge = pc.red(badge);
          break;
      }
    }
    parts.push(badge);

    if (entry.module) {
      parts.push(this.config.colorize ? pc.dim(`[${entry.module}]`) : `[${entry.module}]`);
    }

    parts.push(entry.message);

    if (entry.data !== undefined) {
      if (entry.data instanceof Error) {
        const errText = entry.data.stack || entry.data.message;
        parts.push(`\n${this.config.colorize ? pc.red(errText) : errText}`);
      } else if (typeof entry.data === 'object' && entry.data !== null) {
        parts.push(`\n${JSON.stringify(entry.data, null, 2)}`);
      } else {
        parts.push(String(entry.data));
      }
    }

    return parts.join(' ');
  }

  private formatFile(entry: LogEntry): string {
    const parts: string[] = [];

    if (this.config.timestamp) {
      parts.push(`[${entry.timestamp}]`);
    }

    parts.push(`[${entry.level.toUpperCase().padEnd(5)}]`);

    if (entry.module) {
      parts.push(`[${entry.module}]`);
    }

    parts.push(entry.message);

    if (entry.data !== undefined) {
      if (entry.data instanceof Error) {
        parts.push(`- Error: ${entry.data.stack || entry.data.message}`);
      } else if (typeof entry.data === 'object' && entry.data !== null) {
        parts.push(JSON.stringify(entry.data));
      } else {
        parts.push(String(entry.data));
      }
    }

    return parts.join(' ');
  }
}

export const logger = new Logger();

export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}

export function configureLogger(options: Partial<LoggerOptions>): void {
  logger.configure(options);
}
