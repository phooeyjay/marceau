import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, inlineCode, SlashCommandBuilder } from 'discord.js';
import { HEX_AVENGER, HEX_SEQUENCE } from '../../utilities/appsettings';
import { $log_basic_to_channel } from '../../utilities/logger';
import { $random, $sleep } from '../../utilities/common';

/** @type {Record<string, [SCORE: number, WEIGHT: number][]>} */
const DICE_PROFILES = {
    NORMAL: [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1]],
    AVENGER: [[1, 1], [2, 1], [3, 1], [4, 2], [5, 3], [6, 1]],
    UNLUCKY: [[-6, 1], [1, 3], [2, 3], [3, 1], [5, 1], [6, 1]]
};
const COFFIN_SYMBOL = '⚰️';

/** @param {keyof typeof DICE_PROFILES} state @returns {number[]} */
const roll_5d6 = (state) => {
    let dice = DICE_PROFILES[state];
    const fullweight = dice.reduce((sum, [_, w]) => sum + w, 0);

    let acc = 0;
    dice = dice.map(([score, weight]) => [score, acc += weight / fullweight]);
    return $random(5).map(v => dice.find(([_, weight]) => v < weight)[0] ?? 4);
}

export const data = new SlashCommandBuilder().setName('pray').setDescription('Combat the curse-mark.');

/** 
 * @param {ChatInputCommandInteraction} i
 * @returns {import('../../utilities/logger').SLASH_COMMAND_RESULT}
 */
export const execute = async i => {
    /** @type {GuildMember} */
    const { displayName: member_name, roles: { cache: member_roles } } = i.member;

    const kis = i.guild.roles.cache.get(HEX_SEQUENCE[2]);
    if (!kis) $log_basic_to_channel(`Kismet role not found in guild ${i.guildId}`);

    const tier = member_roles.find(({ id }) => [HEX_AVENGER, ...HEX_SEQUENCE].includes(id));
    if (!tier) return ['error', await i.reply({ 
        content: 'You\'re neither marked nor a vengeful ghost.'
        , ephemeral: true
        , fetchReply: true 
    })];
    const { name: tier_ident = inlineCode('...'), color = 0xDDD, id = '' } = tier;

    await i.deferReply();
    await $sleep(2_000);

    const raised = id == HEX_SEQUENCE[3] || id == HEX_AVENGER && (kis?.members.size ?? 0) > 0
    , sabotaging = id == HEX_SEQUENCE[1] || id == HEX_SEQUENCE[2];

    const rolls = roll_5d6(raised ? 'AVENGER' : sabotaging ? 'UNLUCKY' : 'NORMAL');
    if (id == HEX_SEQUENCE[3] || id == HEX_AVENGER) {
        $log_basic_to_channel(`${tier_ident.toLocaleUpperCase()} ▸ ${member_name} ▸ ${inlineCode(rolls.splice(1).join('\u00A0\u00A0'))}`);
    } // splice and post the last 4 rolls to the log channel.

    const text = inlineCode(`〖 ${rolls.map(r => r <= 0 ? COFFIN_SYMBOL : r).join(', ')} 〗`);
    const sum = rolls.length > 1 && !text.includes(COFFIN_SYMBOL) ? inlineCode(`〖 ${rolls.reduce((a, b) => a + b, 0)} 〗`) : '';

    const embed = new EmbedBuilder()
    .setColor(color)
    .setDescription(`${bold(tier_ident.toLocaleUpperCase())}\n\n${[text, sum].filter(t => t.length > 0).join(' ▸ ')}`);
    return ['complete', await i.editReply({ embeds: [embed] })];
}