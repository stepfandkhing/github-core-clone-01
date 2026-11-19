import { createApp } from './app.ts';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

const envOrigin = process.env.MAKEFUN_ENV_URL?.replace(/\/+$/, '');
const retryLimitMs = 2_500;

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(operation: () => Promise<T>, label: string): Promise<T> {
  let delay = 150;
  for (;;) {
    try {
      return await operation();
    } catch (error) {
      process.stderr.write(`[entry] ${label}: ${error instanceof Error ? error.message : String(error)}\n`);
      await pause(delay);
      delay = Math.min(retryLimitMs, Math.round(delay * 1.7));
    }
  }
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '0.0.0.0', () => {
      server.off('error', reject);
      const address = server.address() as AddressInfo;
      resolve(address.port);
    });
  });
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function run(): Promise<void> {
  if (!envOrigin) throw new Error('MAKEFUN_ENV_URL is missing');

  const server = createApp();
  const port = await listen(server);
  const requestTimeout = 8_000;

  await withRetry(async () => {
    const response = await fetch(`${envOrigin}/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ port }),
      signal: AbortSignal.timeout(requestTimeout),
    });
    if (response.ok || response.status === 409) return;
    if (response.status >= 500 || response.status === 429) throw new Error(`register returned ${response.status}`);
    throw new Error(`register rejected the port with HTTP ${response.status}`);
  }, 'registration retry');

  let delay = 100;
  for (;;) {
    const finished = await withRetry(async () => {
      const response = await fetch(`${envOrigin}/done`, { signal: AbortSignal.timeout(requestTimeout) });
      if (!response.ok) {
        if (response.status >= 500 || response.status === 429) throw new Error(`/done returned ${response.status}`);
        throw new Error(`/done rejected the request with HTTP ${response.status}`);
      }
      const state: unknown = await response.json();
      if (typeof state !== 'object' || state === null || !('done' in state)) {
        throw new Error('/done returned an invalid response');
      }
      return state.done === true;
    }, 'completion poll retry');
    if (finished) break;
    await pause(delay);
    delay = Math.min(retryLimitMs, Math.round(delay * 1.5));
  }

  await close(server);
}

run().catch(async (error: unknown) => {
  process.stderr.write(`[entry] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
