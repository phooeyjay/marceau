(await import('dotenv')).config();

import { Client, Collection, GatewayIntentBits, REST, Routes, inlineCode } from 'discord.js';
import { basic_log, console_log, interaction_log } from './utils/logger.mjs';
import { ERROR_STRING } from './utils/constants.mjs';
import * as scheduler from './utils/scheduler.mjs';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions] });
client.commands = new Collection();

const end_session = _ => { client.destroy(); scheduler.end(); process.exit(0); }

client.once('ready', async _ => {
    try {
        const commands = [];
        for (const file of (await import('node:fs')).readdirSync('./commands').filter(f => f.endsWith('.mjs'))) {
            const command = await import(`./commands/${file}`);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
                client.commands.set(command.data.name, command);
            }
            else throw Error(`[${file}] is missing a required [data] or [execute] property.`);
        }
        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        await rest.put(Routes.applicationCommands(process.env.APPID), { body: commands });

        scheduler.initialize(client);
        console_log(`LOGIN SUCCESS: ${client.user.username}`);
    }
    catch (err) { console_log('Error in [ready] event:', err); end_session(); }
});
client.on('guildMemberRemove', async member => basic_log(`${inlineCode(member.user.username + ' :: ' + member.user.tag)} has left the server.`));
client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName) || (_ => { console_log(`Unknown command [${interaction.commandName}]`); return; })();
            await command.execute(interaction);
            await interaction_log(interaction);
        }
    }
    catch (err) {
        (interaction.replied || interaction.deferred) && await interaction.editReply(ERROR_STRING) || await interaction.reply(ERROR_STRING);
        await interaction_log(interaction, err);
    }
});

process.on('SIGINT', _ => { console_log('FORCE EXIT'); end_session(); });
client.login(process.env.TOKEN);