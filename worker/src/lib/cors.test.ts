import { describe, expect, it } from 'vitest';
import { corsHeadersFor, parseOrigins } from './cors';

const request = (origin?: string) => new Request('https://w.example/api/x', { headers: origin ? { Origin: origin } : {} });

describe('CORS', () => {
  const allowed = parseOrigins('https://site.example/, http://localhost:5173');

  it('parses the origin list and drops trailing slashes', () => {
    expect(allowed).toEqual(['https://site.example', 'http://localhost:5173']);
    expect(parseOrigins(undefined)).toEqual([]);
  });

  it('allows a listed origin and echoes it', () => {
    const headers = corsHeadersFor(request('https://site.example'), allowed);
    expect(headers?.['Access-Control-Allow-Origin']).toBe('https://site.example');
    expect(headers?.Vary).toBe('Origin');
  });

  it('refuses unknown origins and requests without one', () => {
    expect(corsHeadersFor(request('https://evil.example'), allowed)).toBeNull();
    expect(corsHeadersFor(request(), allowed)).toBeNull();
    expect(corsHeadersFor(request('https://site.example.evil.com'), allowed)).toBeNull();
  });
});
