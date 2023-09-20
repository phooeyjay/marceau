import { BaseInteraction, WebhookClient, codeBlock, inlineCode } from 'discord.js';
import { stringify, datetime_now } from './common.mjs';
const log = new WebhookClient({ url: 'https://discord.com/api/webhooks/1103945700141699142/s_u94Gm8OJej36OO_NGbsMpZF0uKv_TchsDNdRnSp2imxHaaQk_cnTvl2hRRHBcUeBsV' });

export const console_log = (...components) => console.log(datetime_now(), '\u00A0\u00A0', ...(components.map(stringify))); // \u00A0 helps to simulate a tabspace in this context.
export const basic_log = async content => {
    try {
        await log.send({ content: `${inlineCode(datetime_now())} 📝 ${stringify(content)}` });
    }
    catch (err) { console_log('Error in [basic_log]:', err); console_log(content); }
}
export const interaction_log = async (/** @type {BaseInteraction} */ interaction, error) => {
    try {
        let data = {
            name: interaction.isChatInputCommand() && interaction.commandName || interaction.isMessageComponent() && interaction.customId || 'NO_IDENT',
            url: interaction.isChatInputCommand() && interaction.replied && (await interaction.fetchReply()).url || interaction.isMessageComponent() && interaction.message.url || 'NO_URL'
        }
        , header = `${inlineCode(datetime_now())} ${error === undefined ? '🆗' : '🆘'} ${interaction.user.username} triggered ${inlineCode(data.name)} ${data.url}`
        , errbox = error && stringify(error) || undefined;
        await log.send({ content: header + (errbox ? `\n${codeBlock('ERROR: ' + errbox)}` : ''), allowedMentions: { users: [] } }); 
    }
    catch (err) { console_log('Error in [interaction_log]:', err); if (error) console(error); }
}