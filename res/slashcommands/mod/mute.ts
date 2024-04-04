import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, bold } from 'discord.js';
import { LOGGER } from '../../utils';
import { message } from '../message';

export const DATA   = new SlashCommandBuilder().setName('mute')
.setDescription('Mute a user for a custom set period.')
.addUserOption(o    => o.setName('user').setDescription('The user.').setRequired(true))
.addNumberOption(o  => o.setName('hours').setDescription('The silence period, with decimal precision.').setRequired(true));

export const exec   = async (i: ChatInputCommandInteraction): Promise<LOGGER.SLASH_COMMAND_RESULT> => {
    const gm = i.options.getMember('user') as GuildMember;
    const hours = i.options.getNumber('hours', true), unmute = hours <= 0;

    await gm.timeout(unmute ? null : hours * 3_600_600);
    return ['complete', await message(i, [`${gm}`, '▸', unmute ? 'Unmuted.' : `Muted for ${bold(hours + ' hours.')}`].join(' '))];
};