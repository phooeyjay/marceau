import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, SlashCommandBuilder, inlineCode } from 'discord.js';
import { LOGGER, error, rng } from '../../utils';
import { HEX_AVENGER, HEX_SEQUENCE, indirect_hex } from './presets';
import { message } from '../message';

/** A defined maximum probability. */ const MAX_π = 0.990, LOSE_SYMBOL = '⚰️';

const request_d6    = (type: 'normal' | 'avenger' | 'unlucky'): [face: number, bound_π: number][] => {
    switch (type) {
        default:        return [[1, 0.165], [2, 0.330], [3, 0.495], [4, 0.660], [5, 0.825], [6, MAX_π]];
        case 'avenger': return [[1, 0.221], [2, 0.357], [3, 0.494], [4, 0.631], [5, 0.768], [6, MAX_π]];
        case 'unlucky': return [[-9_000, 0.114], [1, 0.335], [2, 0.556], [3, 0.776], [5, 0.930], [6, MAX_π]];
    }
};

export const DATA   = new SlashCommandBuilder().setName('pray').setDescription('Fight against the curse of the « mark ».');

export const exec   = async (i: ChatInputCommandInteraction): Promise<LOGGER.SLASH_COMMAND_RESULT> => {
    const guild = i.guild || error('Null guild.'), member = i.member as GuildMember;

    const cm = member.roles.cache.find(r => [HEX_AVENGER, ...HEX_SEQUENCE].includes(r.id));
    if (!cm) return ['error', await message(i, 'Action halted; missing role.', true)];

    await i.deferReply();
    setTimeout(async () => {
        try {
            const amped = cm.id === HEX_SEQUENCE[3] || cm.id === HEX_AVENGER && (guild.roles.cache.get(HEX_SEQUENCE[2])?.members.size || 0) > 0
            , d6        = request_d6(amped ? 'avenger' : indirect_hex(cm.id) ? 'unlucky' : 'normal');

            const rolls = rng(5).map(v => d6.find(f => f[1] >= v * MAX_π)![0] || 4);
            if (cm.id === HEX_AVENGER || cm.id === HEX_SEQUENCE[3]) { // splice to post the latter 4 rolls elsewhere.
                LOGGER.to_channel(`${inlineCode(cm.name.toUpperCase() + ' | ' + member.displayName + ' | ' + rolls.splice(1).join(', '))}`);
            }

            const text  = inlineCode(`〖 ${rolls.map(r => r <= 0 ? LOSE_SYMBOL : r).join(', ')} 〗`)
            , sum       = rolls.length > 1 && !text.includes(LOSE_SYMBOL) ? inlineCode(`〖 ${rolls.reduce((a, b) => a + b, 0)} 〗`) : '';

            const embed = new EmbedBuilder()
            .setColor(cm.color)
            .setFooter({ text: cm.name.toUpperCase() })
            .setDescription([text, sum].filter(t => t.length > 0).join(' ▸ '));

            LOGGER.to_channel_sc(i, ['complete', await i.editReply({ embeds: [embed] })]);
        }
        catch (iex) { LOGGER.to_channel_sc(i, ['error', undefined, iex]); }
    }, 3_000);
    return ['ongoing', undefined];
}