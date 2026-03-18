import { HttpStatus } from '@nestjs/common';
import { LinkRequiredException } from './link-required.exception';

describe('LinkRequiredException', () => {
  it('should create exception with correct status code', () => {
    const exception = new LinkRequiredException('discord', 'test@example.com');

    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
  });

  it('should include provider in response', () => {
    const exception = new LinkRequiredException('discord', 'test@example.com');
    const response = exception.getResponse() as Record<string, unknown>;

    expect(response.provider).toBe('discord');
  });

  it('should mask email in response', () => {
    const exception = new LinkRequiredException('discord', 'test@example.com');
    const response = exception.getResponse() as Record<string, unknown>;

    expect(response.email).toBe('t***@e***.com');
  });

  it('should mask email with multiple TLD parts', () => {
    const exception = new LinkRequiredException('discord', 'user@mail.co.uk');
    const response = exception.getResponse() as Record<string, unknown>;

    expect(response.email).toBe('u***@m***.co.uk');
  });

  it('should handle email without domain gracefully', () => {
    const exception = new LinkRequiredException('discord', 'invalid');
    const response = exception.getResponse() as Record<string, unknown>;

    expect(response.email).toBe('***');
  });

  it('should include error code', () => {
    const exception = new LinkRequiredException('discord', 'test@example.com');
    const response = exception.getResponse() as Record<string, unknown>;

    expect(response.error).toBe('LINK_REQUIRED');
  });
});