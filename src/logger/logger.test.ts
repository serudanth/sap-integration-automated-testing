import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Logger, createLogger, configureLogger, logger, LogEntry } from './index.js';

describe('Logger Module', () => {
  const testDir = resolve(process.cwd(), 'tmp-test-logs');
  const testLogFile = join(testDir, 'test.log');

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it('respects log level priorities for console and customWriter', () => {
    const entries: LogEntry[] = [];
    const log = new Logger({
      level: 'warn',
      enableConsole: false,
      customWriter: (entry) => entries.push(entry)
    });

    log.debug('This is debug');
    log.info('This is info');
    log.warn('This is warn');
    log.error('This is error');

    // Only warn and error should be written
    expect(entries).toHaveLength(2);
    expect(entries[0].level).toBe('warn');
    expect(entries[0].message).toBe('This is warn');
    expect(entries[1].level).toBe('error');
    expect(entries[1].message).toBe('This is error');
  });

  it('filters all logs when level is silent', () => {
    const entries: LogEntry[] = [];
    const log = new Logger({
      level: 'silent',
      fileLevel: 'silent',
      enableConsole: true,
      enableFile: false,
      customWriter: (entry) => entries.push(entry)
    });

    log.debug('debug');
    log.info('info');
    log.warn('warn');
    log.error('error');

    expect(entries).toHaveLength(0);
  });

  it('formats console output with and without colors and timestamps', () => {
    let capturedConsole = '';
    let capturedFile = '';

    const logWithColor = new Logger({
      level: 'debug',
      enableConsole: false,
      colorize: true,
      timestamp: true,
      context: { module: 'my-mod' },
      customWriter: (_, con, file) => {
        capturedConsole = con;
        capturedFile = file;
      }
    });

    logWithColor.debug('Color debug message', { format: 'json' });
    expect(capturedConsole).toContain('[my-mod]');
    expect(capturedConsole).toContain('Color debug message');
    expect(capturedConsole).toContain('"format": "json"');
    expect(capturedFile).toContain('[DEBUG]');
    expect(capturedFile).toContain('[my-mod]');

    // Without color or timestamp
    const logNoColor = new Logger({
      level: 'info',
      enableConsole: false,
      colorize: false,
      timestamp: false,
      customWriter: (_, con) => {
        capturedConsole = con;
      }
    });

    logNoColor.info('Plain info message');
    expect(capturedConsole).toBe('[INFO] Plain info message');
  });

  it('dispatches console output to console.log, console.warn, and console.error', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const log = new Logger({
      level: 'debug',
      enableConsole: true,
      enableFile: false,
      colorize: false,
      timestamp: false
    });

    log.debug('debug test');
    log.info('info test');
    log.warn('warn test');
    log.error('error test');

    expect(logSpy).toHaveBeenCalledWith('[DEBUG] debug test');
    expect(logSpy).toHaveBeenCalledWith('[INFO] info test');
    expect(warnSpy).toHaveBeenCalledWith('[WARN] warn test');
    expect(errorSpy).toHaveBeenCalledWith('[ERROR] error test');
  });

  it('writes logs to file and creates directories automatically', () => {
    const nestedLogFile = join(testDir, 'nested', 'deep', 'output.log');

    const log = new Logger({
      level: 'silent',
      fileLevel: 'info',
      logFile: nestedLogFile,
      enableFile: true,
      timestamp: true,
      context: { module: 'file-test' }
    });

    log.debug('Should not be written to file');
    log.info('First file line', { token: 'secret-123' });
    log.warn('Second file line');

    expect(existsSync(nestedLogFile)).toBe(true);
    const content = readFileSync(nestedLogFile, 'utf-8');
    expect(content).not.toContain('Should not be written to file');
    expect(content).toContain('[INFO ] [file-test] First file line');
    // Verify credential was masked
    expect(content).toContain('******** (REDACTED)');
    expect(content).toContain('[WARN ] [file-test] Second file line');
  });

  it('handles Error objects and primitive data in console and file output', () => {
    let consoleOut = '';
    let fileOut = '';

    const log = new Logger({
      level: 'error',
      colorize: false,
      customWriter: (_, c, f) => {
        consoleOut = c;
        fileOut = f;
      }
    });

    const testError = new Error('Database connection failed');
    log.error('Critical failure', testError);

    expect(consoleOut).toContain('Database connection failed');
    expect(fileOut).toContain('Database connection failed');

    // Primitive data
    log.error('Code number', 404);
    expect(consoleOut).toContain('404');
    expect(fileOut).toContain('404');
  });

  it('supports child loggers with merged context', () => {
    const entries: LogEntry[] = [];
    const parent = new Logger({
      level: 'info',
      context: { parentId: 'p-1', module: 'parent' },
      customWriter: (e) => entries.push(e)
    });

    const child = parent.child({ childId: 'c-2', module: 'child' });
    child.info('Child log message');

    expect(entries).toHaveLength(1);
    expect(entries[0].module).toBe('child');
    expect(entries[0].message).toBe('Child log message');
  });

  it('allows dynamic reconfiguration via setLevel, setFileLevel, setLogFile, and configure', () => {
    const log = new Logger({ level: 'error' });
    expect(log.getLevel()).toBe('error');

    log.setLevel('debug');
    expect(log.getLevel()).toBe('debug');

    log.setFileLevel('warn');
    expect(log.getFileLevel()).toBe('warn');

    log.setLogFile(testLogFile);
    expect(log.getLogFile()).toBe(testLogFile);

    log.setLogFile(false);
    expect(log.getLogFile()).toBe(false);

    log.configure({
      level: 'info',
      fileLevel: 'error',
      logFile: 'logs/custom.log',
      enableConsole: false,
      timestamp: false,
      colorize: false,
      context: { configured: true }
    });

    expect(log.getLevel()).toBe('info');
    expect(log.getFileLevel()).toBe('error');
    expect(log.getLogFile()).toBe('logs/custom.log');
  });

  it('handles circular references in data without throwing', () => {
    const entries: LogEntry[] = [];
    const log = new Logger({
      level: 'info',
      customWriter: (e) => entries.push(e)
    });

    const circularObj: any = { name: 'circular' };
    circularObj.self = circularObj;

    expect(() => {
      log.info('Circular test', circularObj);
    }).not.toThrow();

    expect(entries).toHaveLength(1);
    expect(entries[0].data.self).toBe('[Circular]');
  });

  it('logs HTTP requests with URL and header credential masking and body truncation', () => {
    const entries: LogEntry[] = [];
    const log = new Logger({
      level: 'debug',
      customWriter: (e) => entries.push(e)
    });

    const hugeBody = 'A'.repeat(2500);

    log.logRequest({
      method: 'post',
      url: 'http://user:secret@example.com:50000/XISOAPAdapter/MessageServlet?param=1',
      headers: {
        'Authorization': 'Basic dXNlcjpwYXNz',
        'Content-Type': 'application/xml',
        'Cookie': 'JSESSIONID=12345'
      },
      body: hugeBody,
      timeoutMs: 8000
    });

    expect(entries).toHaveLength(3);
    // Request line at INFO
    expect(entries[0].level).toBe('info');
    expect(entries[0].message).toContain('POST http://***:***@example.com:50000');
    expect(entries[0].message).toContain('(timeout: 8000ms)');

    // Headers at DEBUG
    expect(entries[1].level).toBe('debug');
    expect(entries[1].data.Authorization).toContain('(REDACTED)');
    expect(entries[1].data.Cookie).toContain('(REDACTED)');
    expect(entries[1].data['Content-Type']).toBe('application/xml');

    // Body at DEBUG truncated
    expect(entries[2].level).toBe('debug');
    expect(entries[2].data).toContain('[truncated 500 bytes]');

    // Short body
    const shortLog = new Logger({ level: 'debug', customWriter: (e) => entries.push(e) });
    shortLog.logRequest({ url: 'http://example.com', body: '<ShortPayload/>' });
    const shortEntry = entries.find((e) => e.data === '<ShortPayload/>');
    expect(shortEntry).toBeDefined();
  });

  it('logs HTTP responses for success, SOAP faults, and HTTP errors', () => {
    const entries: LogEntry[] = [];
    const log = new Logger({
      level: 'debug',
      customWriter: (e) => entries.push(e)
    });

    // 1. Success response
    log.logResponse(
      {
        statusCode: 200,
        durationMs: 125,
        messageId: 'msg-abc-123',
        headers: { 'server': 'SAP NetWeaver' },
        body: '<Success/>'
      },
      'http://localhost:50000/endpoint'
    );

    expect(entries[0].level).toBe('info');
    expect(entries[0].message).toContain('200 http://localhost:50000/endpoint [125ms] (MessageID: msg-abc-123)');
    expect(entries[1].data).toEqual({ server: 'SAP NetWeaver' });
    expect(entries[2].data).toBe('<Success/>');

    // 2. SOAP Fault response
    log.logResponse(
      {
        statusCode: 500,
        durationMs: 564,
        isSoapFault: true,
        soapFaultDetails: {
          faultCode: 'SOAP:Server',
          faultString: 'Server Error in RFC Adapter',
          detail: '<detail><error>Missing parameter</error></detail>'
        }
      },
      'http://sapipo2.smretailinc.com:50000/XISOAPAdapter'
    );

    const soapWarnEntry = entries.find((e) => e.level === 'warn');
    expect(soapWarnEntry).toBeDefined();
    expect(soapWarnEntry!.message).toContain('SOAP Fault [SOAP:Server]: Server Error in RFC Adapter');

    const soapDetailEntry = entries.find((e) => e.message.includes('SOAP Fault Detail'));
    expect(soapDetailEntry).toBeDefined();
    expect(soapDetailEntry!.data).toContain('Missing parameter');

    // 3. HTTP Error response (non-SOAP)
    log.logResponse({
      statusCode: 503,
      durationMs: 200
    });

    const errorEntry = entries.find((e) => e.level === 'error');
    expect(errorEntry).toBeDefined();
    expect(errorEntry!.message).toContain('503 [200ms] HTTP Error');

    // 4. Large response body truncated
    log.logResponse({
      statusCode: 200,
      durationMs: 50,
      body: 'B'.repeat(2500)
    });
    const truncatedResEntry = entries.find((e) => typeof e.data === 'string' && e.data.includes('truncated 500 bytes'));
    expect(truncatedResEntry).toBeDefined();
  });

  it('exports singleton logger and helper createLogger / configureLogger', () => {
    expect(logger).toBeInstanceOf(Logger);

    const created = createLogger({ level: 'info' });
    expect(created.getLevel()).toBe('info');

    configureLogger({ level: 'warn' });
    expect(logger.getLevel()).toBe('warn');
  });

  it('safely catches file writing errors without throwing', () => {
    const invalidLogPath = '/sys/not/allowed/root.log';
    const log = new Logger({
      level: 'info',
      fileLevel: 'info',
      logFile: invalidLogPath,
      enableFile: true
    });

    expect(() => {
      log.info('Attempting write to prohibited system path');
    }).not.toThrow();
  });
});
