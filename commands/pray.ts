import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, inlineCode, roleMention, userMention } from 'discord.js';
import { DM_ROLES } from '../constants';
import { Logger, random } from '../utils';

export const data = new SlashCommandBuilder()
.setName('pray')
.setDescription('The confessional is in session.');

export const execute = async (i: ChatInputCommandInteraction) => {
    const tier = i.guild!.members.resolve(i.user)?.roles.cache.find((_, k) => [DM_ROLES.DEATH, DM_ROLES.CANCR, DM_ROLES.SCARL, DM_ROLES.KISMT, DM_ROLES.GREYD, DM_ROLES.GHOST].includes(k));
    if (!tier) return await i.reply({ content: `You may do this as a ${roleMention(DM_ROLES.MARKD)} person, or as a ${roleMention(DM_ROLES.GHOST)}`, ephemeral: true, fetchReply: true });

    const embed = new EmbedBuilder()
    .setAuthor({ name: tier.name.toUpperCase() })
    .setColor(tier.hexColor)
    .setDescription('Consultation in progress. Please be patient.')
    , fetch = await i.reply({ content: `${userMention(i.user.id)}`, embeds: [embed], fetchReply: true })
    , kt = i.guild!.roles.cache.get(DM_ROLES.KISMT);

    setTimeout(async () => {
        try {
            //#region Initializing the probability distribution for the rolling dice.
            const probability_dist = (impact = [0, 0, 0, 0, 0, 0], faces = [1, 2, 3, 4, 5, 6]) => {
                const remainder_dist = (0.99 - (impact = impact.map(v => v !== 0 && 0.165 + v || v)).reduce((s, n) => s + n)) / impact.filter(n => n === 0).length;
                impact = impact.map(v => v === 0 && remainder_dist || v);
                return faces.map((v, ix) => ({ max: impact.slice(0, ix + 1).reduce((s, n) => s + n), value: v }))
            }
            , chances = ((r, exists) => {
                return (r === DM_ROLES.GHOST && exists || r === DM_ROLES.GREYD) && probability_dist([-0.1, 0, 0, 0, 0.05, 0.05])
                || [DM_ROLES.KISMT, DM_ROLES.SCARL].includes(r) && probability_dist([0.05, 0, 0, 0, -0.0125, -0.0375], [0, 1, 2, 3, 4, 5])
                || r === DM_ROLES.CANCR && probability_dist([0.0375, 0.0125, 0, 0, -0.025, -0.025])
                || probability_dist();
            })(tier.id, kt && kt.members.size > 0);
            //#endregion

            //#region Update the submitted message with the result.
            const result = random([DM_ROLES.GREYD, DM_ROLES.GHOST].includes(tier.id) && 1 || 5).map(n => chances.find(p => p.max >= n)!.value)
            , descs = [ 'Result: ' + inlineCode(`« ${result.map(n => n === 0 ? '💀' : n).join(', ')} »`) ];
            if (result.length > 1 && result.every(n => n !== 0)) descs.push('Sum: ' + inlineCode(result.reduce((sum, n) => sum + n, 0).toString()));
            fetch.edit({ embeds: [embed.setDescription(descs.join(' '))] });
            //#endregion
        } catch (err) { Logger.basic(err); }
    }, 3_000);
    return fetch;
};