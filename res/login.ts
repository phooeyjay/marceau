import { Client, TextChannel, inlineCode } from 'discord.js';
import { LOG, getenv } from './utils';
import { DATASET, EXECUTE } from './slash';

export const login = async () => {
    const client = new Client({
        intents:    [ 'Guilds', 'GuildMembers', 'GuildMessages', 'GuildMessageReactions' ],
        presence:   { status: getenv('DEBUG_MODE') === 'true' && 'invisible' || 'online' }
    });
    const logout = async () => { await client.destroy(); process.exit(1); };

    //#region EVENT LISTENERS
    client.once('ready', async sys => {
        try {
            await sys.rest.put(`/applications/${getenv('APP_IDENTIFIER')}/commands`, { body: DATASET });
            LOG.to_cmdl(`READY: ${sys.user.username}.`);
        } catch (ex) { LOG.to_cmdl(ex); await logout(); }
    });
    client.on('interactionCreate', async i => {
        if (i.isChatInputCommand()) {
            try {
                LOG.to_channel_sc(i, await EXECUTE(i));
            } catch (ex) {
                const response = await (async apology => {
                    if (i.replied || i.deferred) {
                        await i.deleteReply();
                        return await (i.channel as TextChannel).send(apology);
                    } else return await i.reply({ fetchReply: true, content: apology });
                })(getenv('GENERIC_ERROR', '🙇‍♂️'));
                LOG.to_channel_sc(i, ['error', response, ex]);
            }
        }
    });
    client.on('guildMemberRemove', async member => LOG.to_channel(`${inlineCode(member.user.username || member.user.tag)} has left the server.`));
    ['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, async () => { LOG.to_cmdl('EXIT.'); await logout(); }));
    //#endregion

    await client.login(getenv('APP_AUTHTOKEN', false));
};