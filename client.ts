import { Client, REST, Routes, inlineCode } from 'discord.js';
import { Logger } from './utils';
import { ERR_RETRY } from './constants';
import { dataset, execute } from './slashcommands';

export const login = async () => {
    const client = new Client({
        intents: [ 'Guilds', 'GuildMembers', 'GuildMessages', 'GuildMessageReactions' ]
        , presence: { status: process.env.DEBUG && 'invisible' || 'online' }
    });
    const logout = async () => { await client.destroy(); process.exit(1); };

    //#region Event listeners
    client.once('ready', async c => {
        try {
            await (new REST().setToken(process.env.TOKEN!)).put(Routes.applicationCommands(process.env.APPID!), { body: dataset });
            Logger.cmdl(`LOGIN: ${c.user.username}`);
        } catch (ex) { Logger.cmdl(ex); await logout(); }
    });
    client.on('interactionCreate', async i => {
        if (i.isChatInputCommand()) {
            try {
                await execute(i);
                Logger.command(i);
            } catch (ex) {
                if (i.replied || i.deferred) {
                    await i.deleteReply();
                    await i.channel?.send(ERR_RETRY);
                }
                else await i.reply({ content: ERR_RETRY });
                Logger.command(i, ex);
            }
        }
    });
    client.on('guildMemberRemove', async member => Logger.write(`${inlineCode(member.user.username || member.user.tag)} has left the server.`));
    ['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, async () => { Logger.cmdl('Exiting.'); await logout(); }));
    //#endregion

    await client.login(process.env.TOKEN);
};