import { ChatInputCommandInteraction, SlashCommandBuilder, bold, userMention } from 'discord.js';
import { throwexc } from '../utils';

export const data = new SlashCommandBuilder()
.setName('mute')
.setDescription('Somebody needs to shut up for a while.')
.addUserOption(o => o.setName('user').setDescription('The user.').setRequired(true))
.addNumberOption(o => o.setName('hours').setDescription('The mute period.').setRequired(true));

export const execute = async (i: ChatInputCommandInteraction) => {
    const gm = i.guild!.members.resolve(i.options.getUser('user')!) || throwexc('GuildMember undefined.')
    , hours = i.options.getNumber('hours')!
    , validPeriod = hours > 0;

    await gm.timeout(validPeriod && hours * 3_600_000 || null);
    await i.reply({ content: `${userMention(gm.id)} has been ` + (validPeriod ? `muted for ${bold(hours + ' hours')}.` : 'unmuted.'), ephemeral: !validPeriod });
};