import { webcrypto } from 'node:crypto';

/** Encapsulates a `throw` as a function. */
export const error      = (e: string | Error) => { throw e instanceof Error ? e : Error(e) };

/** Get a known variable from the dotenv object. If `f` is _false_ instead of a _string_, the method will throw an error due to an undefined environment variable. */
export const get_env    = (v: string, f: string | false = '') => process.env[v] || f === false ? error(`${v} not in dotenv.`) : f;

/** Get the current datetime as a string, in the environment-specified timezone (or UTC if not defined). */
export const timestamp  = () => new Date().toLocaleString('en-GB', { timeZone: get_env('LOCAL_TZ', 'UTC'), timeZoneName: 'shortOffset' });

/** Generate a random array of numbers within the range of 0 (inclusize) ~ 1 (exclusive). */
export const rng        = ((sz?: number) => Array.from(webcrypto.getRandomValues(new Uint8Array(Math.max(sz ?? 0, 1))), n => n / 256)) as (() => number) & ((sz: number) => number[]);
