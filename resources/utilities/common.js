import { webcrypto } from 'node:crypto';

/** Stringifies the input. */
export const $string = (val) => val instanceof Error ? (val.stack || 'BLANK_STACK')
: typeof val === 'object' && val !== null ? JSON.stringify(val, (_, v) => stringify(v))
: String(val);

/**
 * Performs a `throw` operation.
 * @param {string | Error} error The error to throw, which can be a string or an Error object.
 */
export const $throw = (error) => { throw (typeof error === 'string' ? new Error(error) : error); }

/**
 * Generate a random array of numbers normalized into the range of [0, 1).
 * @param {number} size The sample size of the random array.
 */
export const $random = (size = 1) => Array.from(webcrypto.getRandomValues(new Uint8Array(size)), v => v / 256);

/**
 * Pauses execution for a specified duration.
 * @param {number} ms The duration, in milliseconds.
 */
export const $sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));