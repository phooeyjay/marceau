import { Client, Collection, REST, Routes, inlineCode } from 'discord.js';
import { Logger, throwexc } from './utils';
import { ERR_RETRY } from './constants';

export class ExtendedClient extends Client {
    private dictionary = new Collection<string, any>();

    logout = () => (async () => { await this.destroy(); process.exit(1); })();
    static create = () => {
        const client = new ExtendedClient({
            intents: [ 'Guilds', 'GuildMembers', 'GuildMessages', 'GuildMessageReactions' ]
            , presence: { status: process.env.DEBUG && 'invisible' || 'online' }
        });

        //#region Initializing event listeners
        client.once('ready', async c => {
            try {
                (await import('node:fs')).readdirSync(`./slashcommands`).filter(f => f.endsWith('.ts')).forEach(async f => (imp => {
                    ('data' in imp && 'execute' in imp) && client.dictionary.set(imp.data.name, imp) || throwexc(`${f}: missing _data_ or _execute_.`);
                })(await import(`./slashcommands/${f}`)));

                await (new REST().setToken(process.env.TOKEN!)).put(Routes.applicationCommands(process.env.APPID!), { 
                    body: Array.from(client.dictionary.values()).map(v => v.data.toJSON()) 
                });
                Logger.cmdl(`LOGIN: ${c.user.username}`);
            } catch (ex) { Logger.cmdl(ex); client.logout(); }
        });
        client.on('interactionCreate', async i => {
            if (i.isChatInputCommand()) {
                try {
                    const cmd = client.dictionary.get(i.commandName) || throwexc(`${i.commandName}: Get failed.`);
                    await cmd.execute(i);
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