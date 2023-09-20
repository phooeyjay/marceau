import { webcrypto } from 'node:crypto';

export const stringify = obj => obj instanceof Error ? obj.stack.split('\n').map(s => s.trim()).splice(0, 2).join(' ') : // error type, message, and location all in 2 lines.
obj instanceof Object || obj instanceof Array ? JSON.stringify(obj, obj instanceof Object ? Object.getOwnPropertyNames(obj) : undefined) : obj + ''; // empty string concatenated to forcibly convert object to a string.

export const datetime_now = _ => new Date().toLocaleString('en-GB', { 
    timeZone:       'UTC', 
    timeZoneName:   'short', 
    year:           'numeric', 
    month:          'short', 
    day:            '2-digit', 
    hour:           'numeric', 
    minute:         'numeric' 
});

/** @param {number} [size=1] */
export const crandom = size => Array.from(webcrypto.getRandomValues(new Uint8Array(Math.max(size, 1))), n => n / 256);