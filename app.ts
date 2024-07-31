import { Client, inlineCode, TextChannel } from 'discord.js';
import { logw_cmd, logw_channel, logw_appcommand } from './lib/utils/logger';
import { dataset, execute } from './lib/appcommands/compile';
import { appsettings } from './lib/utils/common';

const shutdown = async (bot: Client<boolean>, reason: string) => {
    logw_channel(inlineCode(`Exited » ${reason}.`));
    await bot.destroy().then(() => process.exit(0));
};

(async token => {
    if (token != null && token.trim() !== '') {
        const client = new Client({
            intents:    [ 'Guilds', 'GuildMembers', 'GuildMessages', 'GuildMessageReactions' ],
            presence:   { status: appsettings('DEBUG_MODE') === 'true' ? 'invisible' : 'online' }
        })
        .once('ready', async bot => {
            try {
                await bot.rest.put(`/applications/${appsettings('APP_IDENTIFIER', '_')}/commands`, { body: dataset }); // TODO: body.
                logw_cmd(`READY: ${bot.user.username}`);
            } catch (ex) { logw_cmd(ex); await shutdown(bot, 'ON_READY exception.'); }
        })
        .on('interactionCreate', async i => {
            if (i.isChatInputCommand()) {
                try {
                    logw_appcommand(i, await execute(i));
                } catch (ex) {
                    const response = await (async apology => i.replied || i.deferred 
                        ? await i.deleteReply().then(async () => await (i.channel as TextChannel).send(apology))
                        : await i.reply({ fetchReply: true, content: apology }))(appsettings('GENERIC_ERROR', '🙇‍♂️'));
                    logw_appcommand(i, ['error', response, ex]);
                }
            }
        })
        .on('guildMemberRemove', async ({ user: { username, tag } }) => logw_channel(inlineCode(`${username || tag} has left the server.`)));
        ['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, async () => await shutdown(client, sig)));
        await client.login(token);
    } else logw_cmd('APP_AUTHTOKEN not provided.');
})(appsettings('APP_AUTHTOKEN'));