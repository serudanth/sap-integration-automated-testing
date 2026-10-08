import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { dispatchRequest } from './dispatcher.js';

describe('Dispatcher Module', () => {
  let server: http.Server;
  let serverPort: number;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', () => {
        if (req.url === '/fault') {
          res.writeHead(500, { 'Content-Type': 'text/xml' });
          res.end('<soapenv:Fault><faultcode>SOAP:Server</faultcode><faultstring>Failure</faultstring></soapenv:Fault>');
        } else if (req.url === '/delay') {
          setTimeout(() => {
            res.writeHead(200);
            res.end('delayed');
          }, 500);
        } else if (req.url === '/auth') {
          const auth = req.headers['authorization'];
          res.writeHead(200, { 'Content-Type': 'application/json', 'x-message-id': 'MSG-123-UUID' });
          res.end(JSON.stringify({ authHeader: auth, receivedBody: body }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/xml', 'x-message-id': 'b1c3a647-7589-4e78-98e3-513d6a2f91a0' });
          res.end('<Response><Status>OK</Status></Response>');
        }
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('successfully dispatches POST request and parses response', async () => {
    const res = await dispatchRequest({
      url: `http://127.0.0.1:${serverPort}/api/test`,
      method: 'POST',
      body: '<TestRequest/>'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<Response><Status>OK</Status></Response>');
    expect(res.messageId).toBe('b1c3a647-7589-4e78-98e3-513d6a2f91a0');
    expect(res.isSoapFault).toBe(false);
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('automatically injects Basic Auth from hostConfig credentials', async () => {
    const res = await dispatchRequest(
      {
        url: `http://127.0.0.1:${serverPort}/auth`,
        method: 'POST',
        body: 'auth test'
      },
      {
        host: '127.0.0.1',
        port: serverPort,
        user: 'sap_user',
        password: 'sap_password',
        https: false
      }
    );

    expect(res.statusCode).toBe(200);
    const parsed = JSON.parse(res.body);
    const expectedAuth = 'Basic ' + Buffer.from('sap_user:sap_password').toString('base64');
    expect(parsed.authHeader).toBe(expectedAuth);
    expect(res.messageId).toBe('MSG-123-UUID');
  });

  it('detects SOAP Fault and populates soapFaultDetails', async () => {
    const res = await dispatchRequest({
      url: `http://127.0.0.1:${serverPort}/fault`,
      method: 'POST'
    });

    expect(res.statusCode).toBe(500);
    expect(res.isSoapFault).toBe(true);
    expect(res.soapFaultDetails?.faultCode).toBe('SOAP:Server');
    expect(res.soapFaultDetails?.faultString).toBe('Failure');
  });

  it('aborts on request timeout', async () => {
    await expect(
      dispatchRequest({
        url: `http://127.0.0.1:${serverPort}/delay`,
        timeoutMs: 50
      })
    ).rejects.toThrow(/timed out/i);
  });

  it('aborts when external abortSignal is triggered', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error('User cancelled')), 30);

    await expect(
      dispatchRequest({
        url: `http://127.0.0.1:${serverPort}/delay`,
        timeoutMs: 2000,
        abortSignal: controller.signal
      })
    ).rejects.toThrow(/cancelled/i);
  });

  it('throws descriptive error on connection failure', async () => {
    await expect(
      dispatchRequest({
        url: 'http://127.0.0.1:1/invalid',
        timeoutMs: 500
      })
    ).rejects.toThrow(/HTTP Request Failed/);
  });
});
