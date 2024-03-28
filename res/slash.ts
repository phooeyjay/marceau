import { ChatInputCommandInteraction, Collection, EmbedBuilder, GuildMember, Role, SlashCommandBuilder, TextChannel, bold, inlineCode, roleMention } from 'discord.js';
import { throwexc, datetime, rng, LOG, getenv } from './utils';

const reply = (i: ChatInputCommandInteraction, text: string = `${inlineCode('...')}⏱️`, covert: boolean = false, embed?: EmbedBuilder) => i.reply({
    fetchReply: true, ephemeral: covert, content: text, embeds: !embed ? embed : [embed] });

/** Represents the application command group for events related to the _curse-mark_. */
module HEX {
    /** Defined 2-min timeframe. */ const PERIOD_MS = 120_000, CHOICES: [yes: string, no: string] = ['💀', '😇'];

    //#region Prominent module roles.
    const HEX_SEQUENCE: [death: string, scarlet: string, kismet: string, shade: string] = [getenv('HEX_DEATH'), getenv('HEX_SCARL'), getenv('HEX_KISMT'), getenv('HEX_SHADE')]
    , HEX_GROUPER = getenv('HEX_GROUPER')
    , HEX_MURDIST = getenv('HEX_MURDIST')
    , HEX_AVENGER = getenv('HEX_AVENGER');
    //#endregion

    const indirect_hex  = (h: string) => h === HEX_SEQUENCE[1] || h === HEX_SEQUENCE[2];

    export module MARK {
        const sequencing    = ({ roles }: GuildMember, pool: Collection<string, Role>): [now: Role | null, next: Role | null, last: boolean] => {
            const a = roles.cache.find(r => HEX_SEQUENCE.includes(r.id));
            if (!a) return [null, pool.get(HEX_SEQUENCE[0]) || throwexc('Null initial hex role.'), false]; // user has not been marked yet.

            const b = HEX_SEQUENCE[Math.min(HEX_SEQUENCE.indexOf(a.id) + 1, HEX_SEQUENCE.length)];
            return b === a.id ? [null, null, true] : [a, pool.get(b) || throwexc('Null subsequent hex role.'), false]; // user is at the final stage, or the mark can be upgraded.
        };

        const resolve_hex   = async ({ roles }: GuildMember, set: Role[]) => {
            await roles.remove(HEX_SEQUENCE);
            await roles.add(set, 'Afflicted by /mark');
        };

        export const data   = new SlashCommandBuilder().setName('mark')
        .setDescription('Set a curse-mark on a person.')
        .addUserOption(o => o.setName('who').setDescription('The target of the curse.').setRequired(true))
        .addStringOption(o => o.setName('why').setDescription('A reason for this affliction.'));

        export const exec   = async (i: ChatInputCommandInteraction): Promise<LOG.SLASH_COMMAND_RESULT> => {
            const guild = i.guild || throwexc('Null guild.')
            , whomst = i.options.getMember('who') as GuildMember
            , reason = i.options.getString('why');
            if (whomst.user.bot) return ['complete', await reply(i, 'Cursing a bot is not allowed.')];

            const state = sequencing(whomst, guild.roles.cache.filter((_, k) => HEX_SEQUENCE.includes(k)));
            if (state[2]) return ['complete', await reply(i, `${whomst} cannot be marked any further.`)];

            const embed = new EmbedBuilder()
            .setColor(0xc0c0c0)
            .setDescription(`${whomst} is about to be ${state[1]}.`)
            .setAuthor({ name: `GUILTY ${CHOICES[0]} OR INNOCENT ${CHOICES[1]}`, iconURL: whomst.displayAvatarURL() });
            if (reason) embed.addFields({ name: 'Reason', value: reason });

            await reply(i, undefined, true);
            const m = await (i.channel as TextChannel).send({ 
                content: `${roleMention(HEX_MURDIST)} Poll ends ${datetime(PERIOD_MS, 'T')}`
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
                        const grouper = guild.roles.cache.get(HEX_GROUPER) || throwexc('Null grouper.');
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
                    LOG.to_channel_sc(i, ['error', rc.message, iex]);
                    await rc.message.delete();
                }
            });

            await i.deleteReply();
            return ['complete', m];
        }
    }

    export module PRAY {
        /** A defined maximum probability. */ const MAX_π = 0.990, LOSE_SYMBOL = '⚰️';
        const request_d6    = (type: 'normal' | 'avenger' | 'unlucky'): [face: number, bound_π: number][] => {
            switch (type) {
                default:        return [[1, 0.165], [2, 0.330], [3, 0.495], [4, 0.660], [5, 0.825], [6, MAX_π]];
                case 'avenger': return [[1, 0.221], [2, 0.357], [3, 0.494], [4, 0.631], [5, 0.768], [6, MAX_π]];
                case 'unlucky': return [[-9_000, 0.114], [1, 0.335], [2, 0.556], [3, 0.776], [5, 0.930], [6, MAX_π]];
            }
        };

        export const data   = new SlashCommandBuilder().setName('pray').setDescription('Fight against the curse of the « mark ».');

        export const exec   = async (i: ChatInputCommandInteraction): Promise<LOG.SLASH_COMMAND_RESULT> => {
            const guild = i.guild || throwexc('Null guild.'), member = i.member as GuildMember;

            const cm = member.roles.cache.find(r => [HEX_AVENGER, ...HEX_SEQUENCE].includes(r.id));
            if (!cm) return ['error', await reply(i, 'Action halted; missing role.', true)];

            await i.deferReply();
            setTimeout(async () => {
                try {
                    const amped = cm.id === HEX_SEQUENCE[3] || cm.id === HEX_AVENGER && (guild.roles.cache.get(HEX_SEQUENCE[2])?.members.size || 0) > 0
                    , d6        = request_d6(amped ? 'avenger' : indirect_hex(cm.id) ? 'unlucky' : 'normal');

                    const rolls = rng(5).map(v => d6.find(f => f[1] >= v * MAX_π)![0] || 4);
                    if (cm.id === HEX_AVENGER || cm.id === HEX_SEQUENCE[3]) { // splice to post the latter 4 rolls elsewhere.
                        LOG.to_channel(`${inlineCode(cm.name.toUpperCase() + ' | ' + member.displayName + ' | ' + rolls.splice(1).join(', '))}`);
                    }
                    
                    const text  = inlineCode(`〖 ${rolls.map(r => r <= 0 ? LOSE_SYMBOL : r).join(', ')} 〗`)
                    , sum       = rolls.length > 1 && !text.includes(LOSE_SYMBOL) ? inlineCode(`〖 ${rolls.reduce((a, b) => a + b, 0)} 〗`) : '';

                    const embed = new EmbedBuilder()
                    .setColor(cm.color)
                    .setFooter({ text: cm.name.toUpperCase() })
                    .setDescription([text, sum].filter(t => t.length > 0).join(' ▸ '));

                    LOG.to_channel_sc(i, ['complete', await i.editReply({ embeds: [embed] })]);
                }
                catch (iex) { LOG.to_channel_sc(i, ['error', undefined, iex]); }
            }, 3_000);
            return ['ongoing', undefined];
        }
    }
}

/** Represents the application command group for moderation actions. */
module MOD {
    export module MUTE {
        export const data   = new SlashCommandBuilder().setName('mute')
        .setDescription('Mute a user for a custom set period.')
        .addUserOption(o    => o.setName('user').setDescription('The user.').setRequired(true))
        .addNumberOption(o  => o.setName('hours').setDescription('The silence period, with decimal precision.').setRequired(true));

        export const exec   = async (i: ChatInputCommandInteraction): Promise<LOG.SLASH_COMMAND_RESULT> => {
            const gm = i.options.getMember('user') as GuildMember;
            const hours = i.options.getNumber('hours', true), unmute = hours <= 0;

            await gm.timeout(unmute ? null : hours * 3_600_600);
            return ['complete', await reply(i, [`${gm}`, '▸', unmute ? 'Unmuted.' : `Muted for ${bold(hours + ' hours.')}`].join(' '))];
        };
    }
}

//#region Export declarations.
export const DATASET    = [HEX.MARK.data, HEX.PRAY.data, MOD.MUTE.data].map(d => d.toJSON());
export const EXECUTE    = (i: ChatInputCommandInteraction): Promise<LOG.SLASH_COMMAND_RESULT> => {
    switch (i.commandName) {
        case 'mark':    return HEX.MARK.exec(i);
        case 'pray':    return HEX.PRAY.exec(i);
        case 'mute':    return MOD.MUTE.exec(i);
        default:        return throwexc('Command not implemented.');
    }
};
//#endregion

// module GGZ {
//     export module STATUS {
//         export const data   = new SlashCommandBuilder().setName('status')
//         .setDescription('A status window, all about you.');

//         export const exec   = (i: ChatInputCommandInteraction): Promise<LOG.RESULT_BODY> => (async gm => {
//             //const record = await DB.get_user(id);
//             //if (!record) return ['complete', await i.reply({ fetchReply: true, ephemeral: true, content: 'No records of you can be found.' }), null];

//             const embed = new EmbedBuilder()
//             .setThumbnail(gm.displayAvatarURL())
//             .setFooter({ text: `Member since ${gm.joinedAt?.toLocaleString() || 'DATE_ERROR'}` })
//             .addFields({ name: 'Current Experience', value: `${inlineCode(Array(16).fill('◻').join(''))} ${bold('Level 0')}` });
//             (r => embed.setColor(r.color).setAuthor({ name: `${gm.displayName} 【 ${r.name.toUpperCase()} 】` }))(gm.roles.highest);

//             return ['complete', await i.reply({ fetchReply: true, ephemeral: true, embeds: [embed] }), null];
//         })(i.member as GuildMember || throwexc('Null GuildMember.'));
//     }
// }
