import { ChatInputCommandInteraction, SlashCommandBuilder, bold, userMention } from 'discord.js';

export const data = new SlashCommandBuilder()
.setName('mute')
.setDescription('Somebody needs to shut up for a while.')
.addUserOption(o => o.setName('user').setDescription('The user.').setRequired(true))
.addNumberOption(o => o.setName('hours').setDescription('The mute period.').setRequired(true));

export const execute = async (/** @type {ChatInputCommandInteraction} */ interaction) => {
    const gm = interaction.guild.members.resolve(interaction.options.getUser('user'))
    , hours = interaction.options.getNumber('hours')
    , validPeriod = hours && hours > 0;

    await gm.timeout(validPeriod ? hours * 3_600_000 : null);
    return await interaction.reply({ content: `${userMention(gm.id)} has been ` + (validPeriod ? `muted for ${bold(hours + ' hours')}.` : 'unmuted.'), ephemeral: !validPeriod });
}