import { ChatInputCommandInteraction, Message, WebhookClient, channelMention, codeBlock, inlineCode } from 'discord.js';
import { timestamp, get_env } from './misc';

const as_str    = (u: unknown) => u ? (u instanceof Error ? u.stack || '' : typeof u === 'object' ? JSON.stringify(u, (_, v) => as_str(v)) : `${u}`) : '';
const WEBHOOK   = new WebhookClient({ url: `https://discord.com/api/webhooks/${get_env('APP_LOGGER_URL')}` });

export type SLASH_COMMAND_RESULT = [status: 'complete' | 'ongoing', response: Message | undefined] | [status: 'error', response: Message | undefined, error?: Error];

/** Performs a `console.log`. */
export const to_cmdl        = (...data: unknown[]) => console.log(timestamp(), '\u00A0\u00A0', ...data.map(as_str));

/** Post a message to the logger channel. */
export const to_channel     = (a: unknown) => {
    (async (str, now) => {
        try {
            await WEBHOOK.send({ content: `${inlineCode(now)} \u00A0\u00A0 ${str}` });
        } catch (ex) { to_cmdl(ex, '\n--------------------\n', str); }
    })(as_str(a), timestamp());
};

/** Post `ChatInputCommandInteraction` information to the logger channel.  */
export const to_channel_sc  = ({ user, commandName, channelId }: ChatInputCommandInteraction, [status, response, error]: SLASH_COMMAND_RESULT) => {
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
                , failed ? codeBlock(as_str(error)) : null
            ].filter((bit): bit is string => bit !== null).join(' ').trim();
            await WEBHOOK.send({ content: description });
        } catch (ex) { to_cmdl(ex, failed ? `\n--------------------\n${as_str(error)}` : ''); }
    })(error !== undefined, timestamp());
}