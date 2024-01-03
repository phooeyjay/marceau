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
    return !format ? dt.toLocaleString('en-GB', { timeZone: process.env.GMT8_TZ, timeZoneName: 'shortOffset' }) : time(Math.trunc(dt.getTime() / 1_000), format)
})(new Date(new Date().getTime() + (offset || 0)));

/** Given a sample size, randomly generate values normalized into the range of 0 (inclusize) ~ 1 (exclusive). */
export const rng = ((sz?: number) => Array.from(webcrypto.getRandomValues(new Uint8Array(Math.max(sz ?? 0, 1))), n => n / 256)) as (() => number) & ((sz: number) => number[]);

/** Function-callable `throw`. */
export const throwexc = (ex: string | Error) => { throw ex instanceof Error ? ex : new Error(ex) };

/** Less-breaking version of `ChatInputCommandInteraction.deferReply` */
export const defer = async (i: ChatInputCommandInteraction) => await i.reply({ ephemeral: true, fetchReply: true, content: '⏳' });
//#endregion

export module LOG {
    const WEBHOOK = new WebhookClient({ url: `https://discord.com/api/webhooks/${process.env.API_URL}` });
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

export module DB {
    //#region SCHEMA DECLARATIONS
    type USER_PROFILE = { guild: string, username: string, accumulated_exp: number, updated: string, inventory: { talents: string[], hex_tokens: number } };
    //#endregion

    const connect = () => DynamoDBDocument.from(new DynamoDBClient({ 
        apiVersion: process.env.APIVER!
        , region: process.env.REGION!
        , credentials: { secretAccessKey: process.env.SECRET!, accessKeyId: process.env.ACCKEY! } 
    }));

    const table = (name: 'UserProfile' | 'Guillotine' | 'InfoDump') => (connection => {
        const fetch = async <T extends Record<string, unknown> = {}>(key: Record<string, string | number>) => {
            try {
                const output = await connection.get({ TableName: name, Key: key, ConsistentRead: true });
                return <T>(output.Item);
            } catch (ex) { LOG.text(ex); return null; }
        }
        , place = async (key: Record<string, string | number>, attributes: Record<string, unknown>) => {
            try {
                const output = await connection.put({ TableName: name, Item: { ...key, ...attributes }, ReturnValues: 'UPDATED_NEW' });
                return output.Attributes !== undefined;
            } catch (ex) { LOG.text(ex); return false; }
        };
        return { fetch, place };
    })(connect());

    export const get_user = async (uid: string) => await table('UserProfile').fetch<Pick<USER_PROFILE, 'accumulated_exp' | 'inventory'>>({ id: uid });

    export const sync_users = async (client: Client) => {
        try {
            LOG.text('SYNC_PROFILES ▸ Begin.');
            type SYNC_PROFILE = Pick<USER_PROFILE, 'guild' | 'username' | 'updated'>;
            const { members } = await client.guilds.fetch(process.env.GUILDID || throwexc('Null GUILDID.')), tb = table('UserProfile');
            for (const [id, { guild, user }] of members.cache.filter(m => m.roles.cache.has(process.env.PATRONID || throwexc('Null PATRONID.')))) {
                (async record => {
                    record.guild = guild.id;
                    record.username = user.username;
                    record.updated = datetime();
                    await tb.place({ id: id }, record);
                })(await tb.fetch<SYNC_PROFILE>({ id: id }) || <SYNC_PROFILE>{});
            }
            LOG.text('SYNC_PROFILES ▸ End.');
        } catch (ex) { LOG.text(ex); }
    }
}