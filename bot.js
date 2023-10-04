(await import('dotenv')).config();

import { Client, Collection, GatewayIntentBits, REST, Routes, inlineCode } from 'discord.js';
import { Logger, Scheduler } from './utils.js';
import { ERROR_STRING } from './constants.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions] })
, performGC = async () => { await client.destroy(); Scheduler.halt(); process.exit(); }
client.commands = new Collection();

client.once('ready', async () => {
    try {
        const commands = [];
        for (const file of (await import('node:fs')).readdirSync('./commands').filter(f => f.endsWith('.js'))) {
            const command = (await import(`./commands/${file}`)).default;
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                commands.push(command.data.toJSON());
            } else throw Error(`Missing property in [${file}]`);
        }
        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        await rest.put(Routes.applicationCommands(process.env.APPID), { body: commands });
        
        Scheduler.launch('0 0 0-23/6 * * *', () => { Logger.basic(`${inlineCode(client.user.tag)} is active.`) }, 'SYS_CLOCKIN');
        Logger.console(`LOGIN SUCCESS: ${client.user.username}`);
    }
    catch (err) { Logger.console('Error in [ready] event:', err); performGC(); }
});
client.on('guildMemberRemove', async member => Logger.basic(`${inlineCode(member.user.username || member.user.tag)} has left the server.`));
client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName) || (() => { Logger.console(`Unknown command [${interaction.commandName}]`); return; })();
            await command.execute(interaction);
            Logger.interaction(interaction);
        }
    }
    catch (err) {
        (interaction.replied || interaction.deferred) && await Promise.all([ interaction.deleteReply(), interaction.channel.send(ERROR_STRING) ]) || await interaction.reply(ERROR_STRING);
        Logger.interaction(interaction, err);
    }
});
process.on('SIGINT', () => { Logger.console('FORCE EXIT'); performGC(); });

await client.login(process.env.TOKEN);
client.user.setPresence({ status: process.env.STATUS || 'online' });