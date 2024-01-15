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
export const stringify = (a: unknown): string => a ? (
    a instanceof Error ? (a.stack || 'NO_STACK').split('\n').slice(0, 2).join(' ')
    : typeof a === 'object' ? JSON.stringify(a, k => stringify(a[k])) : `${a}`
) : '';

/**
 * Format a datetime as a string.
 * - If `format` is not defined, the `dd/mm/yyyy, hh:mm:ss TZ` format is used.
 * - Else, use the `discordjs.time` function for formatting.
 */
export const datetime = (offset?: number, format?: 'F' | 'R' | 'T'): string => (dt => {
    return !format ? dt.toLocaleString('en-GB', { timeZone: process.env.LOCAL_TZ!, timeZoneName: 'shortOffset' }) : time(Math.trunc(dt.getTime() / 1_000), format)
})(new Date(new Date().getTime() + (offset || 0)));

/** Given a sample size, randomly generate values normalized into the range of 0 (inclusize) ~ 1 (exclusive). */
export const rng = ((sz?: number) => Array.from(webcrypto.getRandomValues(new Uint8Array(Math.max(sz ?? 0, 1))), n => n / 256)) as (() => number) & ((sz: number) => number[]);

/** Function-callable `throw`. */
export const throwexc = (ex: string | Error) => { throw ex instanceof Error ? ex : new Error(ex) };

/** Less-breaking version of `ChatInputCommandInteraction.deferReply` */
export const defer = async (i: ChatInputCommandInteraction) => await i.reply({ ephemeral: true, fetchReply: true, content: '⏳' });
//#endregion

export module LOG {
    const WEBHOOK = new WebhookClient({ url: `https://discord.com/api/webhooks/${process.env.APP_LOGGER_URL}` });
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
                    now
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
    type TABLES   = {
        'USER_PROFILE': { key: { id: string }, username: string, accumulated_exp: number, updated: string },
        'CONFESSIONAL': { key: { started: string }, active: boolean, hexed: Record<string, number>, ghost: number[] }
    };
    type FLATTEN<T>     = { 
        [K in keyof T]: K extends symbol ? never : K | (T[K] extends object ? T[K] extends Array<any> | Record<string, any> ? K : `${K & string}.${FLATTEN<T[K]>}` : never)  
    }[keyof T];

    const use_api       = () => DynamoDBDocument.from(new DynamoDBClient({ 
        apiVersion: process.env.AWS_VERSION!
        , region: process.env.AWS_REGION!
        , credentials: { secretAccessKey: process.env.AWS_SECRET!, accessKeyId: process.env.AWS_AUTHKEY! } 
    }));

    const use_table     = <TS extends keyof TABLES>(name: TS) => (api => {
        type TARGET_SCHEMA  = TABLES[TS];
        type TARGET_KEY     = Pick<TARGET_SCHEMA, 'key'>['key'];
        const fetch = async (key: TARGET_KEY) => {
            try {
                const out = (await api.get({ TableName: name, Key: key, ConsistentRead: true })).Item || null;
                return !out ? null : out as TARGET_SCHEMA;
            } catch (ex) { LOG.text(ex); return null; }
        }
        , amend = async (key: TARGET_KEY, mapper: (o: Omit<TARGET_SCHEMA, 'key'>) => void) => {
            try {
                const res = (await fetch(key) || {}) as TARGET_SCHEMA;
                mapper(res);
                return (await api.put({ TableName: name, Item: res, ReturnValues: 'UPDATED_NEW' })).Attributes !== undefined;
            } catch (ex) { LOG.text(ex); return false; }
        }
        , where = async (path: FLATTEN<Omit<TARGET_SCHEMA, 'key'>>, operand: 'EQ' | 'NOT' | 'GT' | 'GTE' | 'LT' | 'LTE', value: unknown) => {
            try {
                const filter = (opn => `${path} ${opn} ${typeof value === 'string' ? `'${value}'` : value}`)((
                <Record<typeof operand, string>>{
                    'EQ'    : '='
                    , 'NOT' : '<>' 
                    , 'GT'  : '>'
                    , 'GTE' : '>='
                    , 'LT'  : '<'
                    , 'LTE' : '<='
                })[operand]);
                const out = (await api.query({ TableName: name, FilterExpression: filter, ConsistentRead: true })).Items;
                return !out ? null : out.map(r => r as TARGET_SCHEMA);
            } catch (ex) { LOG.text(ex); return null; }
        }
        return { fetch, amend, where };
    })(use_api());

    export const get_user   = async (uid: string) => await use_table('USER_PROFILE').fetch({ id: uid });
    export const sync_users = async (client: Client) => {
        try {
            LOG.text('SYNC_USERS ▸ Begin.');
            const { members } = await client.guilds.fetch(process.env.APP_GUILD || throwexc('Null Guild ID.')), t = use_table('USER_PROFILE');
            for (const [id, { user }] of members.cache.filter(m => m.roles.cache.has(process.env.VERIFIED_USER || throwexc('Null Verified User Grouping.')))) {
                await t.amend({ id: id }, u => {
                    u.username  = user.username;
                    u.updated   = datetime();
                });
            }
            LOG.text('SYNC_USERS ▸ End.');
        } catch (ex) { LOG.text(ex); }
    }

    // export const find_active_trial  = async () => await use_table('CONFESSIONAL').where('active', 'EQ', true);
    // export const begin_trial        = use_table('CONFESSIONAL').amend;
}