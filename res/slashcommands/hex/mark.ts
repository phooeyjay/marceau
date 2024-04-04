import { ChatInputCommandInteraction, Collection, EmbedBuilder, GuildMember, Role, SlashCommandBuilder, TextChannel, bold, roleMention, time } from 'discord.js';
import { CHOICES, HEX_GROUPER, HEX_MURDIST, HEX_SEQUENCE, PERIOD_MS, indirect_hex } from './presets';
import { LOGGER, error, rng } from '../../utils';
import { message } from '../message';

const sequencing    = ({ roles }: GuildMember, pool: Collection<string, Role>): [now: Role | null, next: Role | null, last: boolean] => {
    const a = roles.cache.find(r => HEX_SEQUENCE.includes(r.id));
    if (!a) return [null, pool.get(HEX_SEQUENCE[0]) || error('Null initial hex role.'), false]; // user has not been marked yet.

    const b = HEX_SEQUENCE[Math.min(HEX_SEQUENCE.indexOf(a.id) + 1, HEX_SEQUENCE.length)];
    return b === a.id ? [null, null, true] : [a, pool.get(b) || error('Null subsequent hex role.'), false]; // user is at the final stage, or the mark can be upgraded.
};

const resolve_hex   = async ({ roles }: GuildMember, set: Role[]) => {
    await roles.remove(HEX_SEQUENCE);
    await roles.add(set, 'Afflicted by /mark');
};

export const DATA   = new SlashCommandBuilder().setName('mark')
.setDescription('Set a curse-mark on a person.')
.addUserOption(o => o.setName('who').setDescription('The target of the curse.').setRequired(true))
.addStringOption(o => o.setName('why').setDescription('A reason for this affliction.'));

export const exec   = async (i: ChatInputCommandInteraction): Promise<LOGGER.SLASH_COMMAND_RESULT> => {
    const guild = i.guild || error('Null guild.')
    , whomst = i.options.getMember('who') as GuildMember
    , reason = i.options.getString('why');
    if (whomst.user.bot) return ['complete', await message(i, 'Cursing a bot is not allowed.')];

    const state = sequencing(whomst, guild.roles.cache.filter((_, k) => HEX_SEQUENCE.includes(k)));
    if (state[2]) return ['complete', await message(i, `${whomst} cannot be marked any further.`)];

    const embed = new EmbedBuilder()
    .setColor(0xc0c0c0)
    .setDescription(`${whomst} is about to be ${state[1]}.`)
    .setAuthor({ name: `GUILTY ${CHOICES[0]} OR INNOCENT ${CHOICES[1]}`, iconURL: whomst.displayAvatarURL() });
    if (reason) embed.addFields({ name: 'Reason', value: reason });

    await message(i, undefined, true);
    const m = await (i.channel as TextChannel).send({ 
        content: `${roleMention(HEX_MURDIST)} Poll ends ${time(PERIOD_MS, 'T')}`
        , allowedMentions: { parse: ['roles'], repliedUser: false } 
        , embeds: [embed]
    });
    for (const c of CHOICES) await m.react(c);

    const rc = m.createReactionCollector({ time: PERIOD_MS, filter: ({emoji}, {bot}) => !bot && CHOICES.includes(emoji.name || '') });
    rc.on('collect', ({emoji}, u) => rc.message.reactions.resolve(CHOICES.filter(c => c !== emoji.name)[0])!.users.remove(u));
    rc.on('end', async (dict, r) => {
        try {
            if (r === 'messageDelete') return await (rc.message.channel as TextChannel).send(`${whomst} has been freed from malicious intent.`);
            
            const [unvoted, sway, bits] = ((ysz, nsz) => {
                ysz -= 1; nsz -= 1; // less 1 due to one increment from bot's initial reaction.
                return [ysz <= 0 && nsz <= 0, ysz - nsz, [bold(`${ysz} voted YES, ${nsz} voted NO`) + '\n']]
            })(dict.find(e => e.emoji.name === CHOICES[0])?.count || 1, dict.find(e => e.emoji.name === CHOICES[1])?.count || 1);

            if (unvoted || sway > 0) {
                const grouper = guild.roles.cache.get(HEX_GROUPER) || error('Null grouper.');
                bits.push(`By ${unvoted ? 'default' : 'majority'}, ${whomst} is now ${state[1]!}.`);

                //#region If the curse mark can cause collateral, do so.
                if (indirect_hex(state[1]!.id) && rng() >= 0.75) {
                    const hex_cap = HEX_SEQUENCE.slice(0, HEX_SEQUENCE.indexOf(state[1]!.id)) // perform end-index exclusion.
                    , collt = grouper.members.filter(m => m.id !== whomst.id && m.roles.cache.hasAny(...hex_cap)).random()!;

                    bits.push(`${collt} has also been afflicted due to the nature of the curse.`);
                    for (const m of [whomst, collt]) await resolve_hex(m, [grouper, state[1]!]);
                } else await resolve_hex(whomst, [grouper, state[1]!])
                //#endregion
            } else bits.push(`${whomst} survives.`);

            const modded_embed = embed.setDescription(bits.join(' ').trim() + '\n').setColor(state[1]!.color)
            await Promise.all([rc.message.reactions.removeAll(), rc.message.edit({ content: roleMention(HEX_MURDIST), embeds: [modded_embed] })]);
        }
        catch (iex) {
            LOGGER.to_channel_sc(i, ['error', rc.message, iex]);
            await rc.message.delete();
        }
    });

    await i.deleteReply();
    return ['complete', m];
}