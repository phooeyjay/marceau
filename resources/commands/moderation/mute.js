import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder().setName('mute')
.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
.setDescription('Mute a server member for a specified duration in hours.')
.addUserOption(o => o.setName('user').setDescription('The user to mute').setRequired(true))
.addNumberOption(o => 
    o.setName('hours')
    .setMinValue(0)
    .setMaxValue(24)
    .setRequired(true)
    .setDescription('The duration to mute the user for.')
);

/** 
 * @param {ChatInputCommandInteraction} i
 * @returns {import('../../utilities/logger').SLASH_COMMAND_RESULT}
 */
export const execute = async i => {
    const user = i.options.getMember('user'), duration = i.options.getNumber('hours', true);

    if (!user || !user.moderatable) return ['error', await i.reply({ 
        content: 'Invalid or unmoderatable user.'
        , ephemeral: true
        , fetchReply: true })];

    await user.timeout(duration > 0 ? duration * 3_600_000 : null);
    return ['complete', await i.reply({
        content: `${user} ▸ ${inlineCode(duration > 0 ? `Muted for ${duration} hours.` : 'Unmuted.')}`
        , ephemeral: false
        , fetchReply: true
    })];
};