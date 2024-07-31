import { time } from 'discord.js';
import { webcrypto as wc } from 'node:crypto';

/** Stringifies an incoming object. */
export const stringify = (a: unknown) => a == null ? '' : a instanceof Error ? (a.stack || a.message) : typeof a === 'object' ? JSON.stringify(a, k => stringify(a[k])) : `${a}`;

export const throw_exception = (v: string | Error) => { throw v instanceof Error ? v : Error(v) };

/** Given a sample size (sz), generate a random array of floating-points within the range [0, 1). */
export const randomized_floats = (sz: number) => Array.from(wc.getRandomValues(new Uint8Array(Math.max(sz, 1))), n => n / 256);

/** Retrieves a key-associated value fron the environment variables, using a fallback string if none found. */
export const appsettings = (key: string, fallback: string = '') => process.env[key] || fallback;

/** Formats a datetime as a string, using either `discord.js.time` if `style` is defined, else the environment's `toLocaleString`. */
export const datetime = (offset?: number, style?: 'F' | 'R' | 'T') => (dt => !style ? dt.toLocaleString('en-GB', { timeZone: appsettings('LOCAL_TZ', 'UTC'), timeZoneName: 'shortOffset' }) : time(Math.trunc(dt.getTime() / 1_000)))(new Date(new Date().getTime() + (offset || 0)));