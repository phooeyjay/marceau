import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
    .setName('trial')
    .setDescription('Manage a court trial in the assigned courtroom.')
    .addSubcommand(sc => sc.setName('begin').setDescription('Begin a court trial.'))
    .addSubcommand(sc => sc.setName('end').setDescription('End the current court trial.')),

    execute: async (/** @type {ChatInputCommandInteraction} */ i) => {
        switch (i.options.getSubcommand()) {
            case 'begin': {
                
            }; break;
            case 'end': {
    
            }; break;
        }
    }
}