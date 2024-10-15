import { Client, TextChannel, inlineCode } from 'discord.js';
import { Logger, fromenv } from './tools';
import { DATASET, EXECUTE } from './sc';

export const login = async () => {
    const client = new Client({
        intents:    [ 'Guilds', 'GuildMembers', 'GuildMessages', 'GuildMessageReactions' ],
        presence:   { status: fromenv('DEBUG_MODE') === 'true' && 'invisible' || 'online' }
    });
    const logout = async () => { await client.destroy(); process.exit(1); };

    //#region EVENT LISTENERS
    client.once('ready', async sys => {
        try {
            await sys.rest.put(`/applications/${fromenv('APP_IDENTIFIER')}/commands`, { body: DATASET });
            Logger.to_cmdl(`READY: ${sys.user.username}.`);
        } catch (ex) { Logger.to_cmdl(ex); await logout(); }
    });
    client.on('interactionCreate', async i => {
        if (i.isChatInputCommand()) {
            try {
                Logger.to_logs_sc(i, await EXECUTE(i));
            } catch (ex) {
                const response = await (async apology => {
                    if (i.replied || i.deferred) {
                        await i.deleteReply();
                        return await (i.channel as TextChannel).send(apology);
                    } else return await i.reply({ fetchReply: true, content: apology });
                })(fromenv('GENERIC_ERROR'));
                Logger.to_logs_sc(i, ['error', response, ex]);
            }
        }
    });
    client.on('guildMemberRemove', async member => Logger.to_logs(`${inlineCode(member.user.username || member.user.tag)} has left the server.`));
    ['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, async () => { Logger.to_cmdl('EXIT.'); await logout(); }));
    //#endregion

    await client.login(fromenv('APP_AUTHTOKEN'));
};