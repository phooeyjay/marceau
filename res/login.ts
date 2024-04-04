import { Client, TextChannel, inlineCode } from 'discord.js';
import { LOGGER, get_env } from './utils';
import { DATASET, EXECUTE } from './slashcommands';

export const login = async () => {
    const client = new Client({
        intents:    [ 'Guilds', 'GuildMembers', 'GuildMessages', 'GuildMessageReactions' ],
        presence:   { status: get_env('DEBUG_MODE') === 'true' && 'invisible' || 'online' }
    });
    const logout = async () => { await client.destroy(); process.exit(1); };

    //#region EVENT LISTENERS
    client.once('ready', async sys => {
        try {
            await sys.rest.put(`/applications/${get_env('APP_IDENTIFIER')}/commands`, { body: DATASET });
            LOGGER.to_cmdl(`READY: ${sys.user.username}.`);
        } catch (ex) { LOGGER.to_cmdl(ex); await logout(); }
    });
    client.on('interactionCreate', async i => {
        if (i.isChatInputCommand()) {
            try {
                LOGGER.to_channel_sc(i, await EXECUTE(i));
            } catch (ex) {
                const response = await (async apology => {
                    if (i.replied || i.deferred) {
                        await i.deleteReply();
                        return await (i.channel as TextChannel).send(apology);
                    } else return await i.reply({ fetchReply: true, content: apology });
                })(get_env('GENERIC_ERROR', '🙇‍♂️'));
                LOGGER.to_channel_sc(i, ['error', response, ex]);
            }
        }
    });
    client.on('guildMemberRemove', async member => LOGGER.to_channel(`${inlineCode(member.user.username || member.user.tag)} has left the server.`));
    ['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, async () => { LOGGER.to_cmdl('EXIT.'); await logout(); }));
    //#endregion

    await client.login(get_env('APP_AUTHTOKEN', false));
};