import { time, inlineCode, codeBlock, channelMention, WebhookClient, ChatInputCommandInteraction, Client, Message } from 'discord.js';
import { webcrypto } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

//#region NON-MODULARIZED FUNCTIONS
/**
 * - An `undefined` or `null` will return an empty string.
 * - An `Error` will be reduced to the first 2 lines of the stack trace, or a string literal if the stack is empty.
 * - An `Object` or `Array` will undergo JSON.stringify, with each sub-component calling this `stringify` method.
 * - Else, the value will be forcibly converted into a string by concatenating an empty string. 
 */
export const stringify  = (a: unknown): string => a ? (
    a instanceof Error ? (a.stack || 'NO_STACK').split('\n').map(s => s.trim()).join(' ') : typeof a === 'object' ? JSON.stringify(a, k => stringify(a[k])) : `${a}`
) : '';

/**
 * Format a datetime as a string.
 * - If `format` is not defined, the `dd/mm/yyyy, hh:mm:ss TZ` format is used.
 * - Else, use the `discordjs.time` function for formatting.
 */
export const datetime   = (offset?: number, format?: 'F' | 'R' | 'T'): string => (dt => {
    return !format ? dt.toLocaleString('en-GB', { timeZone: getenv('LOCAL_TZ', 'UTC'), timeZoneName: 'shortOffset' }) : time(Math.trunc(dt.getTime() / 1_000), format)
})(new Date(new Date().getTime() + (offset || 0)));

/** Given a sample size, randomly generate values normalized into the range of 0 (inclusize) ~ 1 (exclusive). */
export const rng        = ((sz?: number) => Array.from(webcrypto.getRandomValues(new Uint8Array(Math.max(sz ?? 0, 1))), n => n / 256)) as (() => number) & ((sz: number) => number[]);

/** Function-callable `throw`. */
export const throwexc   = (ex: string | Error) => { throw ex instanceof Error ? ex : new Error(ex) };

/** Get a known variable from the dotenv object. If `alt` is `false` instead of a string, the method will throw an error due to undefined environment variable. */
export const getenv     = (variable: string, alt: string | false = '') => process.env[variable] || (alt === false ? throwexc(`${variable} missing in dotenv`) : alt);
//#endregion

export module LOG {
    const WEBHOOK = new WebhookClient({ url: `https://discord.com/api/webhooks/${getenv('APP_LOGGER_URL')}` });
    export type RESULT_BODY = [status: 'complete' | 'ongoing' | 'error', response: Message | null, error: Error | null];

    /** Performs a `console.log`. */
    export const cmdl = (...data: unknown[]) => console.log(datetime(), '\u00A0\u00A0', ...data.map(stringify));

    /** Post a message to the logger channel. */
    export const text = (a: unknown) => {
        (async (str, now) => {
            try {
                await WEBHOOK.send({ content: `${inlineCode(now)} \u00A0\u00A0 ${str}` });
            } catch (ex) { cmdl(ex, '\n--------------------\n', str); }
        })(stringify(a), datetime());
    };

    /** Post `ChatInputCommandInteraction` information to the logger channel.  */
    export const interaction = (i: ChatInputCommandInteraction, d: RESULT_BODY) => {
        const [status, response, error] = d;
        const { user, commandName, channelId } = i;
        (async (failed, now) => {
            try {
                const description = [
                    inlineCode(now)
                    , '\u00A0\u00A0'
                    , inlineCode(status)
                    , inlineCode(user.username)
                    , '▸'
                    , inlineCode(commandName)
                    , '▸'
                    , response?.url || channelMention(channelId)
                    , failed ? codeBlock(stringify(error)) : null
                ].filter((bit): bit is string => bit !== null).join(' ').trim();
                await WEBHOOK.send({ content: description });
            } catch (ex) { cmdl(ex, failed ? `\n--------------------\n${stringify(error)}` : null); }
        })(error !== null, datetime());
    }
}

export module DBXC {
    const get_api   = () => DynamoDBDocument.from(new DynamoDBClient({ 
        apiVersion: getenv('AWS_VERSION', false)
        , region: getenv('AWS_REGION', false)
        , credentials: { secretAccessKey: getenv('AWS_SECRET', false), accessKeyId: getenv('AWS_AUTHKEY', false) } 
    }));

    //#region BLUEPRINT METHODS
    const fetch = async <R extends Record<string, unknown> = never>(from: string, key: Record<string, string | number>) => {
        const response = await get_api().get({ TableName: from, Key: key, ConsistentRead: true });
        return response.Item ? response.Item as R : null;
    };
    const where = async <R extends Record<string, unknown> = never>(from: string, op: 'EQ' | 'NOT' | 'GT' | 'GTE' | 'LT' | 'LTE', path: string, value: unknown) => {
        const filter = (opn => `${path} ${opn} ${JSON.stringify(value)}`)((
            {
                'EQ'    : '='
                , 'NOT' : '<>' 
                , 'GT'  : '>'
                , 'GTE' : '>='
                , 'LT'  : '<'
                , 'LTE' : '<='
            } as Record<typeof op, string>)[op]);
            const response = await get_api().query({ TableName: from, FilterExpression: filter, ConsistentRead: true });
            return response.Items ? response.Items.map(r => r as R) : null;
    };
    const amend = async <T extends string = never>(from: T, key: Record<string, string | number>, op: 'SET' | 'ADD' | 'DELETE', ...kv: Array<[string, string | number | boolean | object]>) => {
        const stmt = `${op} ` + kv.map(([k, v]) => k + (op === 'SET' ? ' = ' : ' ') + JSON.stringify(v));
        const response = await get_api().update({ TableName: from, Key: key, UpdateExpression: stmt, ReturnValues: 'UPDATED_NEW' });
        return response.Attributes && Object.keys(response.Attributes).length > 0;
    };
    //#endregion

    export module USERS {
        type S  = { PK: { id: string }, username: string, exp: number };
        const N = 'USER_PROFILE';

        export const get    = async (uid: string) => fetch<Omit<S, 'PK'>>(N, { id: uid });
    }
}