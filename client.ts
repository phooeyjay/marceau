import { Client, Collection, REST, Routes, inlineCode } from 'discord.js';
import { Logger, Scheduler, throwexc } from './utils';
import { ERR_RETRY } from './constants';
import { dataset, route } from './routecommands'

export class ExtendedClient extends Client {
    logout = () => (async () => { await this.destroy(); Scheduler.halt(); process.exit(1); })()

    static initialize = () => {
        const client = new ExtendedClient({ 
            intents:    [ 'Guilds', 'GuildMembers', 'GuildMessages', 'GuildMessageReactions' ],
            presence:   { status: process.env.DEBUG && 'invisible' || 'online' } // Whatever the fuck 'invisible' is in this context.
        });

        //#region Event listeners - initialization
        client.once('ready', async c => {
            try {
                await (new REST().setToken(process.env.TOKEN!)).put(Routes.applicationCommands(process.env.APPID!), { body: dataset });
                Logger.cli(`LOGIN: ${c.user.username}`);
            } catch (err) { Logger.cli('[Client.ready] error:', err); client.logout();  }
        });
        client.on('interactionCreate', async i => {
            if (i.isChatInputCommand()) {
                try {
                    await route(i.commandName, i);
                    Logger.command(i);
                } catch (err) {
                    (i.replied || i.deferred) && await i.deleteReply().then(async () => await i.channel?.send(ERR_RETRY)) || await i.reply({ content: ERR_RETRY });
                    Logger.command(i, err);
                }
            }
        });
        client.on('guildMemberRemove', async member => Logger.plaintext(`${inlineCode(member.user.username || member.user.tag)} has left the server.`));
        ['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, () => { Logger.cli('Exiting.'); client.logout() }));
        //#endregion

        return client;
    }
}