import { bold, ChatInputCommandInteraction, Collection, EmbedBuilder, GuildMember, inlineCode, Role, roleMention, SlashCommandBuilder, TextChannel } from 'discord.js';
import { APPCOMMAND_RESULT, logw_appcommand } from '../../utils/logger';
import { throw_exception, datetime, randomized_floats } from '../../utils/common';
import { can_indirect_hex, hex_yn, hex_categories, hex_marks } from './common';

const argname_target = 'who', argname_reason = 'why';

/** Returns a tuple denoting the user's current cursemark, and either the subsequent cursemark to be promoted to, or `END` to signify that the user cannot be cursed further.  */
const sequencing = ({ roles: { cache } }: GuildMember, pool: Collection<string, Role>): [now: Role | null, next: Role | 'END'] => {
    const a = cache.find(r => hex_marks.includes(r.id));
    if (!a) return [null, pool.get(hex_marks[0]) || throw_exception('Null initial hex state.')]; // user has not been marked yet.

    const b = hex_marks[Math.min(hex_marks.indexOf(a.id) + 1, hex_marks.length)];
    return b === a.id ? [null, 'END'] : [a, pool.get(b) || throw_exception('Null subsequent hex state.')]; // user is on the last mark, or the mark can be promoted.
};
const resolve_hex = async ({ roles }: GuildMember, set: Role[]) => await roles.remove(hex_marks).then(async () => await roles.add(set, 'Afflicted by /mark.'));

export const data = new SlashCommandBuilder().setName('mark')
.setDescription('Set a curse-mark on a person.')
.addUserOption(o => o.setName(argname_target).setDescription('The target of the curse.').setRequired(true))
.addStringOption(o => o.setName(argname_reason).setDescription('A reason for this affliction.'));

export const execute = async (i: ChatInputCommandInteraction): Promise<APPCOMMAND_RESULT> => {
    const reason = i.options.getString(argname_reason);
    const whomst = i.options.getMember(argname_target) as GuildMember;
    if (whomst.user.bot) return ['complete', await i.reply({ fetchReply: true, content: 'Cursing a bot is not allowed.' })];

    const { roles: { cache } } = i.guild || throw_exception('Null guild.');
    const tier = sequencing(whomst, cache.filter((_, k) => hex_marks.includes(k)));
    if (tier[1] === 'END') return ['complete', await i.reply({ fetchReply: true, content: `${whomst} cannot be cursed any further.` })];

    const embed = new EmbedBuilder()
    .setColor(0xc0c0c0)
    .setDescription(`${whomst} is about to be ${tier[1]}.`)
    .setAuthor({ name: `GUILTY ${hex_yn[0]} OR INNOCENT ${hex_yn[1]}`, iconURL: whomst.displayAvatarURL() });
    if (reason) embed.addFields({ name: 'Reason', value: reason });

    const period_msec = 120_000;
    await i.reply({ content: `${inlineCode('...')}⏱️`, ephemeral: true });
    const msg = await (i.channel as TextChannel).send({
        content: `${roleMention(hex_categories[1])} Poll ends ${datetime(period_msec, 'T')}`
        , allowedMentions: { parse: ['roles'], repliedUser: false } 
        , embeds: [embed]
    });
    await Promise.allSettled([msg.react(hex_yn[0]), msg.react(hex_yn[1])]);

    const rc = msg.createReactionCollector({ time: period_msec, filter: ({ emoji }, { bot }) => !bot && hex_yn.includes(emoji.name || '') })
    .on('collect', ({ emoji }, u) => rc.message.reactions.resolve(hex_yn.filter(c => c !== emoji.name)[0])!.users.remove(u))
    .on('end', async (dict, r) => {
        try {
            if (r === 'messageDelete') return await (rc.message.channel as TextChannel).send(`${whomst} has been freed from malicious intent.`);

            const promote = tier[1] as Role;
            const [unvoted, sway, bits] = ((ysz, nsz) => {
                ysz -= 1; nsz -= 1; // less 1 due to one increment from bot's initial reaction.
                return [ysz <= 0 && nsz <= 0, ysz - nsz, [bold(`${ysz} voted YES, ${nsz} voted NO`) + '\n']]
            })(dict.find(e => e.emoji.name === hex_yn[0])?.count || 1, dict.find(e => e.emoji.name === hex_yn[1])?.count || 1);

            if (unvoted || sway > 0) {
                const group = cache.get(hex_categories[0]) || throw_exception('Null parent group.');
                bits.push(`By ${unvoted ? 'default' : 'majority'}, ${whomst} is now ${promote}.`);

                //#region If the curse can cause collateral, do so.
                if (can_indirect_hex(promote.id) && (randomized_floats(1).pop() || 0.5) >= 0.75) {
                    const collateral = (array => {
                        return group.members.filter(({ id, roles }) => id !== whomst.id && roles.cache.hasAny(...array)).random()!;
                    })(hex_marks.slice(0, hex_marks.indexOf(promote.id))); // end-index exclusion.

                    bits.push(`${collateral} has also been afflicted due to the nature of the curse.`);
                    for (const _ of [whomst, collateral]) await resolve_hex(_, [group, promote]);
                } else await resolve_hex(whomst, [group, promote]);
                //#endregion
            } else bits.push(`${whomst} survives.`);

            const modded_embed = embed.setDescription(bits.join(' ').trim() + '\n').setColor(promote.color);
            await Promise.allSettled([rc.message.reactions.removeAll(), rc.message.edit({ content: roleMention(hex_categories[1]), embeds: [modded_embed] })]);
        }
        catch (err) {
            logw_appcommand(i, ['error', rc.message, err]);
            await rc.message.delete();
        }
    });

    await i.deleteReply();
    return ['complete', msg];
}