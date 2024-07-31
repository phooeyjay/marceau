import { channelMention, ChatInputCommandInteraction, codeBlock, inlineCode, Message, WebhookClient } from 'discord.js';
import { appsettings, datetime, stringify } from './common';

const webhook = new WebhookClient({ url: `https://discord.com/api/webhooks/${appsettings('APP_LOGGER_URL')}` });

export type APPCOMMAND_RESULT = [status: 'complete' | 'pending', response: Message | null] | [status: 'error', response: Message | null, error: Error | null];
export const logw_cmd = (...data: unknown[]) => console.log(datetime(), '\u00A0\u00A0', ...data.map(stringify));
export const logw_channel = (a: unknown) => {
    (async (str, now) => {
        try{
            await webhook.send({ content: `${inlineCode(now)} \u00A0\u00A0 ${str}` });
        } catch (e) { logw_cmd(e, '\n--------------------\n', str); }
    })(stringify(a), datetime());
};
export const logw_appcommand = ({ user, commandName, channelId }: ChatInputCommandInteraction, [status, response, error]: APPCOMMAND_RESULT) => {
    (async (failed, now) => {
        try{
            const desc = [
                inlineCode(now)
                , '\u00A0\u00A0'
                , inlineCode(status)
                , inlineCode(user.username)
                , '▸'
                , inlineCode(commandName)
                , '▸'
                , response?.url || channelMention(channelId)
                , failed ? codeBlock(stringify(error)) : null
            ].filter((bit): bit is string => bit != null).join(' ').trim();
            await webhook.send({ content: desc });
        } catch (e) { logw_cmd(e, failed ? `\n--------------------\n${stringify(error)}` : ''); }
    })(error != null, datetime());
};