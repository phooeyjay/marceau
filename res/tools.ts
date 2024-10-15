import { channelMention, ChatInputCommandInteraction, codeBlock, inlineCode, Message, WebhookClient } from 'discord.js';
import { webcrypto } from 'node:crypto';

/** Stringifies the given argument `u`, which can be of any data type. */
export const as_str = (u: unknown): string => u instanceof Error ? (u.stack || 'EMPTY_STACK')
: typeof u === 'object' && u != null ? JSON.stringify(u, (_, v) => as_str(v))
: '' + u;

/** Gets the current datetime as a string representation. */
export const get_date = (): string => new Date().toLocaleString('en-GB', { timeZone: 'Asia/Singapore', timeZoneName: 'shortOffset' });

/** Given a sample size, randomly generate values normalized into the range of 0 (inclusize) ~ 1 (exclusive). */
export const random = ((sz?: number) => {
    const values = Array.from(webcrypto.getRandomValues(new Uint8Array(Math.max(sz ?? 1, 1))), n => n / 256);
    return sz === 1 ? values[0] : values;
}) as ((a?: 0 | 1) => number) & ((a: number) => number[]);

/** Gets the value tied to an environment variable. */
export const fromenv = (key: string): string => key && key in process.env && process.env[key] || '';

/** Encapsulate a `throw` as a callable. */
export const raise = (error: string | Error): never => { throw (typeof error === 'string' ? new Error(error) : error); }

export namespace Logger {
    const ENDPOINT = new WebhookClient({ url: `https://discord.com/api/webhooks/${fromenv('APP_LOGGER_URL')}` }); 
    export type APPCOMMAND_RESULT = [status: 'complete', response: Message | undefined] | [status: 'error', response: Message | undefined, error?: Error];

    /** Write to the server terminal. */
    export const to_cmdl = (...u: unknown[]) => console.log(get_date(), '\u00A0\u00A0', ...u.map(as_str));

    /** Writes the argument `u` to the logging channel. */
    export const to_logs = (u: unknown, inlined: boolean = false) => {
        (async (str, date) => {
            try {
                await ENDPOINT.send({ content: `${inlineCode(date)} \u00A0\u00A0 ${str}` });
            } catch (err) { to_cmdl(err, '\n--------------------\n', str); }
        })(typeof u === 'string' ? (inlined ? inlineCode(u) : u) : as_str(u), get_date());
    }

    /** Writes the `APPCOMMAND_RESULT` to the logging channel. */
    export const to_logs_sc = ({ user, commandName, channelId }: ChatInputCommandInteraction, [status, response, error]: APPCOMMAND_RESULT) => (success => {
        const desc = [
            inlineCode(status)
            , inlineCode(user.username)
            , '▸'
            , inlineCode(commandName)
            , '▸'
            , response?.url || channelMention(channelId)
            , success ? null : codeBlock(as_str(error))
        ].filter((bit): bit is string => bit !== null).join(' ').trim();
        to_logs(desc);
    })(!error);
}