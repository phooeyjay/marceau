import { Client, Collection, REST, Routes, inlineCode } from 'discord.js';
import { Logger, throwexc } from './utils';
import { ERR_RETRY } from './constants';
import { dataset, execute } from './slashcommands';

export class ExtendedClient extends Client {
    logout = () => (async () => { await this.destroy(); process.exit(1); })();
    static create = () => {
        const client = new ExtendedClient({
            intents: [ 'Guilds', 'GuildMembers', 'GuildMessages', 'GuildMessageReactions' ]
            , presence: { status: process.env.DEBUG && 'invisible' || 'online' }
        });

        //#region Initializing event listeners
        client.once('ready', async c => {
            try {
                await (new REST().setToken(process.env.TOKEN!)).put(Routes.applicationCommands(process.env.APPID!), { body: dataset });
                Logger.cmdl(`LOGIN: ${c.user.username}`);
            } catch (ex) { Logger.cmdl(ex); client.logout(); }
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
        ['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, () => { Logger.cmdl('Exiting.'); client.logout(); }));
        //#endregion

        return client;
    }
}