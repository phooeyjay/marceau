import { bold, ChatInputCommandInteraction, EmbedBuilder, GuildMember, inlineCode, SlashCommandBuilder } from 'discord.js';
import { can_indirect_hex, hex_categories, hex_marks } from './common';
import { randomized_floats, throw_exception } from '../../utils/common';
import { APPCOMMAND_RESULT, logw_appcommand, logw_channel } from '../../utils/logger';

const d6_scores = (type: 'normal' | 'avenger' | 'cursed'): number[] => {
    const max_π = 0.990;
    const d6: [score: number, bound: number][] = type === 'avenger' ? [[1, 0.083], [2, 0.248], [3, 0.413], [4, 0.578], [5, 0.784], [6, max_π]]
    : type === 'cursed' ? [[-69, 0.110], [2, 0.330], [3, 0.550], [4, 0.660], [5, 0.770], [6, max_π]]
    : [[1, 0.165], [2, 0.330], [3, 0.495], [4, 0.660], [5, 0.825], [6, max_π]];
    return randomized_floats(5).map(v => d6.find(f => f[1] >= v * max_π)![0] || 4);
};

export const data = new SlashCommandBuilder().setName('pray').setDescription('Use it for when you have been \'curse-marked\'.');

export const execute = async (i: ChatInputCommandInteraction): Promise<APPCOMMAND_RESULT> => {
    const { roles: guild_roles } = i.guild || throw_exception('Null guild object.');
    const { roles: membr_roles, displayName: membr_name } = i.member as GuildMember;

    const tier = membr_roles.cache.find(({ id }) => [...hex_marks, hex_categories[2]].includes(id));
    if (!tier) return ['complete', await i.reply({ content: 'You\'re neither marked nor a vengeful ghost.', ephemeral: true, fetchReply: true })];
    const { id: mark_id, name: mark_identity, color: mark_tint } = tier;

    await i.deferReply();
    setTimeout(async () => {
        try{
            const amped = mark_id === hex_marks[3] || mark_id === hex_categories[2] && (guild_roles.cache.get(hex_marks[2])?.members.size || 0) > 0;
            const scores = d6_scores(amped ? 'avenger' : can_indirect_hex(mark_id) ? 'cursed' : 'normal');
    
            const post_elsewhere = mark_id === hex_categories[2] || mark_id === hex_marks[3];
            if (post_elsewhere) logw_channel(inlineCode(`${mark_identity.toUpperCase()} | ${membr_name} | ${scores.splice(1).join(', ')}`));
    
            const lose_symbol = '⚰️';
            const text = inlineCode(`〖 ${scores.map(r => r <= 0 ? lose_symbol : r).join(', ')} 〗`);
            const sum = scores.length > 1 && !text.includes(lose_symbol) ? inlineCode(`〖 ${scores.reduce((a, b) => a + b, 0)} 〗`) : '';
    
            const embed = new EmbedBuilder()
            .setColor(mark_tint)
            .setDescription(bold(mark_identity) + '\n\n' + [text, sum].filter(t => t.length > 0).join(' ▸ '));
            if (post_elsewhere) embed.setFooter({ text: 'The lottery box has been filled with 4 random numbers...' });

            logw_appcommand(i, ['complete', await i.editReply({ embeds: [embed] })]);
        }
        catch (err) { logw_appcommand(i, ['error', null, err]); }
    }, 3_000);
    return ['pending', null];
}