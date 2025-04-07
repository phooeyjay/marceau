import { channelMention, ChatInputCommandInteraction, codeBlock, inlineCode, WebhookClient } from 'discord.js';
import { APPLICATION_LOGGER_URL } from './appsettings';
import { $string } from './common';

/** @typedef {['complete', Message?] | ['error', Message?, Error?]} SLASH_COMMAND_RESULT */

const WEBHOOKCLIENT = new WebhookClient({ url: `https://discord.com/api/webhooks/${APPLICATION_LOGGER_URL}` });

/** Returns a formatted datetime string. */
const date = () => new Date().toLocaleString('en-GB', { timeZone: 'Asia/Singapore',  timeZoneName: 'shortOffset' });

/** Write a message to the discord's logger channel in a simple format. */
export const $log_basic_to_channel = (val) => {
    (async (is_object, string, timestamp) => {
        try {
            await WEBHOOKCLIENT.send({ content: `${inlineCode(timestamp)} \u00A0\u00A0 ${is_object ? inlineCode(string) : string}` })
        } catch (error) {
            console.log(timestamp, '\u00A0\u00A0',  error, '\n--------------------\n', string);
        }
    })(typeof val ==='object', $string(val), date());
}

/**
 * Write a message to the discord's logger channel that describes the outcome of the command.
 * @param {ChatInputCommandInteraction} interaction 
 * @param {SLASH_COMMAND_RESULT} param 
 */
export const $log_command_to_channel = ({ user, commandName, channelId }, [status, res = null, error = null]) => {
    const success = !error;
    const desc = [
        inlineCode(status)
        , inlineCode(user.username)
        , '▸'
        , inlineCode(commandName)
        , '▸'
        , res?.url || channelMention(channelId)
        , success ? null : codeBlock(stringify(error))
    ].filter(part => part != null).join(' ').trim();
    $log_basic_to_channel(desc);
}