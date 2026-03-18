import { LoggingMiddleware } from './logging.middleware';
import type { Request, Response } from 'express';

function makeReq(method = 'GET', originalUrl = '/test'): Partial<Request> {
  return { method, originalUrl };
}

function makeRes(): Partial<Response> & { _finish: () => void } {
  const listeners: Record<string, () => void> = {};
  return {
    statusCode: 200,
    on: jest.fn((event: string, cb: () => void) => {
      listeners[event] = cb;
    }) as any,
    _finish: () => listeners['finish']?.(),
  };
}

describe('LoggingMiddleware', () => {
  let middleware: LoggingMiddleware;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    middleware = new LoggingMiddleware();
    logSpy = jest.spyOn((middleware as any).logger, 'log').mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('calls next()', () => {
    const next = jest.fn();
    const res = makeRes();
    middleware.use(makeReq() as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('logs method, url, status, and duration on response finish', () => {
    const next = jest.fn();
    const res = makeRes();
    res.statusCode = 201;

    middleware.use(makeReq('POST', '/oauth/session') as Request, res as Response, next);
    res._finish();

    expect(logSpy).toHaveBeenCalledTimes(1);
    const message: string = logSpy.mock.calls[0][0];
    expect(message).toContain('POST');
    expect(message).toContain('/oauth/session');
    expect(message).toContain('201');
    expect(message).toMatch(/\d+ms/);
  });

  it('does not log before the response finishes', () => {
    const next = jest.fn();
    const res = makeRes();
    middleware.use(makeReq() as Request, res as Response, next);
    expect(logSpy).not.toHaveBeenCalled();
  });
});
