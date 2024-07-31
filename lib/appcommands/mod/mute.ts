import { bold, ChatInputCommandInteraction, GuildMember, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { APPCOMMAND_RESULT } from '../../utils/logger';

const argname_user = 'user', argname_period = 'hours';

export const data = new SlashCommandBuilder().setName('mute')
.setDescription('Mute a user for a custom set period.')
.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
.addUserOption(o => o.setName(argname_user).setDescription('The user.').setRequired(true))
.addNumberOption(o => o.setName(argname_period).setDescription('The decimal-point silence period.').setRequired(true));

export const execute = async ({ options, reply }: ChatInputCommandInteraction): Promise<APPCOMMAND_RESULT> => {
    const member = options.getMember(argname_user) as GuildMember;
    const period = options.getNumber(argname_period, true);
    const unmute = period <= 0;

    await member.timeout(unmute ? null : period * 3_600_000); // 1 hour in milliseconds.
    return ['complete', await reply({ fetchReply: true, content: unmute ? `Unmuted ${member}.` : `Muted ${member} for ${bold(period + ' hours.')}` })];
}