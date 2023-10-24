import { Client, Collection, REST, Routes, inlineCode } from 'discord.js';
import { Logger, Scheduler, throwexc } from './utils';
import { ERROR_STRING } from './constants';

export class ExtendedClient extends Client {
    private commands: Collection<string, { data: any, execute: any }> = new Collection();

    logout = () => (async () => { await this.destroy(); Scheduler.halt(); process.exit(1); })()

    static initialize = () => {
        const client = new ExtendedClient({ 
            intents:    [ 'Guilds', 'GuildMembers', 'GuildMessages', 'GuildMessageReactions' ],
            presence:   { status: process.env.DEBUG && 'invisible' || 'online' } // Whatever the fuck 'invisible' is in this context.
        });

        //#region Event listeners - initialization
        client.once('ready', async c => {
            try {
                for (const f of (await import('node:fs')).readdirSync('./commands').filter(f => f.endsWith('.ts'))) {
                    const cmd = (await import(`./commands/${f}`));
                    ('data' in cmd && 'execute' in cmd) && client.commands.set(cmd.data.name, cmd) || throwexc(`Missing property in [${f}]`);
                }
                await (new REST().setToken(process.env.TOKEN!)).put(Routes.applicationCommands(process.env.APPID || throwexc('APPID undefined.')), { body: client.commands.map(c => c.data.toJSON()) });
                Logger.cli(`LOGIN: ${c.user.username}`);
            } catch (err) { Logger.cli('[Client.ready] error:', err); client.logout();  }
        });
        client.on('interactionCreate', async i => {
            if (i.isChatInputCommand()) {
                try {
                    await (client.commands.get(i.commandName) || throwexc(`Unknown command [${i.commandName}]`)).execute(i);
                    Logger.command(i);
                } catch (err) {
                    (i.replied || i.deferred) && await i.deleteReply().then(async () => await i.channel?.send(ERROR_STRING)) || await i.reply({ content: ERROR_STRING });
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