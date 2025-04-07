import { Client, inlineCode, Message } from 'discord.js';
import { DEBUG_MODE, APPLICATION_TOKEN, GENERIC_ERROR_MESSAGE } from './utilities/appsettings';
import { $log_basic_to_channel, $log_command_to_channel } from './utilities/logger';
import { $sleep, $string } from './utilities/common';


export const connect = async () => {
    const bot = new Client({
        intents: ['Guilds', 'GuildMembers', 'GuildMessages', 'GuildMessageReactions'],
        presence: { status: DEBUG_MODE == 'true' ? 'invisible' : 'online' }
    });

    let in_shutdown_state = false;
    const disconnect = async (code = 0, reason = 'Shutdown') => {
        if (in_shutdown_state) return;
        in_shutdown_state = true;
    
        $log_basic_to_channel(`Bot is disconnecting: ${inlineCode(reason)}`); 
        await bot.destroy();
        await $sleep(5_000);
        process.exit(code);
    }

    //#region Bot event listeners
    bot.once('ready', async () => {
        try{
            await bot.rest.put(`/applications/${bot.user.id}/commands`, { body: [] });
            $log_basic_to_channel(`${inlineCode(bot.user.username)} has successfully logged in.`);
        } catch (error) {
            $log_basic_to_channel(error);
            await disconnect(1, 'Error in ready event listener');
        }
    });

    bot.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand()) return;

        try {
            // TODO:
        } catch (error) {
            /** @type {Message} */ let response;
            if (interaction.replied || interaction.deferred) {
                response = await interaction.editReply(GENERIC_ERROR_MESSAGE);
            } else response = await interaction.reply({ content: GENERIC_ERROR_MESSAGE, fetchReply: true });
            $log_command_to_channel(interaction, ['error', response, error])
        }
    });

    bot.on('guildMemberRemove', async member => $log_basic_to_channel(`${inlineCode(member.user.username)} has left the server.`));
    //#endregion

    //#region Process signal listeners
    ['SIGINT', 'SIGTERM'].forEach(signal => process.on(signal, async () => await disconnect(0, signal)));
    process.on('unhandledRejection', async error => await disconnect(1, $string(error)));
    process.on('uncaughtException', async error => await disconnect(1, error.message));
    //#endregion

    await bot.login(APPLICATION_TOKEN);
}