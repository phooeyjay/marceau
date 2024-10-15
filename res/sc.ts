// Container for the application commands.
import { ActionRowBuilder, bold, ChatInputCommandInteraction, Collection, ComponentType, EmbedBuilder, GuildMember, inlineCode, PermissionFlagsBits, Role, roleMention, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextChannel, time } from 'discord.js';
import { fromenv, Logger, raise, random } from './tools';
type APPC_RESULT_FUNC = (_: ChatInputCommandInteraction) => Promise<Logger.APPCOMMAND_RESULT>;

const reply = (i: ChatInputCommandInteraction, ephemeral: boolean, text: string = inlineCode('...')) => i.reply({
    fetchReply: true, ephemeral: ephemeral, content: text
});
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

namespace MOD {
    export namespace MUTE {
        export const data = new SlashCommandBuilder().setName('mute')
        .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
        .setDescription('Mute a user for a custom set period.')
        .addUserOption(a => a.setName('user').setDescription('The user.').setRequired(true))
        .addNumberOption(a => a.setName('hours').setDescription('The silence period, with decimal precision.').setRequired(true));

        export const execute: APPC_RESULT_FUNC = async i => {
            const gm = i.options.getMember('user') as GuildMember, hours = i.options.getNumber('hours', true);

            await gm.timeout(hours > 0 ? hours * 3_600_000 : null);
            return ['complete', await reply(i, false, `${gm} ▸ ${inlineCode(hours > 0 ? `Muted for ${hours} hours.` : 'Unmuted.')}`)];
        }
    }
}

namespace HEX {
    //#region Prominent namespace roles
    const HEX_CHAIN: [death: string, scarl: string, kismet: string, shade: string] = [
        fromenv('HEX_DEATH'), 
        fromenv('HEX_SCARL'), 
        fromenv('HEX_KISMT'), 
        fromenv('HEX_SHADE')
    ];
    const MARKED = fromenv('HEX_MARKED'), MURDIST = fromenv('HEX_MURDIST'), AVENGER = fromenv('HEX_AVENGER');
    //#endregion

    const sabotager_role = (role: string) => role === HEX_CHAIN[1] || role === HEX_CHAIN[2];

    export namespace PRAY {
        const LOSE_SYMBOL = '⚰️';

        const DICE_PROFILES: Record<string, [score: number, wt: number][]> = {
            normal: [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1]], // all scores are equal.
            avenger: [[1, 1], [2, 1], [3, 1], [4, 2], [5, 3], [6, 1]], // avenger profile.
            unlucky: [[-6, 1], [1, 3], [2, 3], [3, 1], [5, 1], [6, 1]] // unlucky profile.
        };

        const roll_d6 = (type: keyof typeof DICE_PROFILES): number[] => {
            let dice = DICE_PROFILES[type];
            const fullwt = dice.reduce((sum, [, w]) => sum + w, 0);

            let acc = 0;
            dice = dice.map(([score, wt]) => [score, acc += wt / fullwt]);
            return random(5).map(v => dice.find(([, bound]) => bound >= v)?.[0] ?? 4); // 4 is the default score.
        };
        
        export const data = new SlashCommandBuilder().setName('pray').setDescription('Fight against the curse-mark.');

        export const execute: APPC_RESULT_FUNC = async i => {
            const { displayName: member_name, roles: { cache: member_roles } } = i.member as GuildMember;

            const kismet = (i.guild ?? raise('Null guild')).roles.cache.get(HEX_CHAIN[2]);
            if (!kismet) Logger.to_logs('Kismet role not found.', true);

            const tier = member_roles.find(r => [AVENGER, ...HEX_CHAIN].includes(r.id));
            if (!tier) return ['error', await reply(i, true, 'You\'re neither marked nor a vengeful ghost.')];

            const { id = '', color = 0xFFF, name: tier_definition = inlineCode('...') } = tier;
            const amped = id === HEX_CHAIN[3] || id === AVENGER && (kismet?.members.size ?? 0) > 0;

            await i.deferReply();
            await wait(2_000);

            const rolls = roll_d6(amped ? 'avenger' : sabotager_role(id) ? 'unlucky' : 'normal');
            if (id === HEX_CHAIN[3] || id === AVENGER) {
                Logger.to_logs(`${tier_definition.toLocaleUpperCase()} ▸ ${member_name} ▸ ${rolls.splice(1).join(' . ')}`, true);
            } // splice to post the latter 4 rolls to the logger.

            const text = inlineCode(`〖 ${rolls.map(r => r <= 0 ? LOSE_SYMBOL : r).join(', ')} 〗`);
            const sum = rolls.length > 1 && !text.includes(LOSE_SYMBOL) ? inlineCode(`〖 ${rolls.reduce((a, b) => a + b, 0)} 〗`) : '';

            const embed = new EmbedBuilder()
            .setColor(color)
            .setDescription(`${bold(tier_definition.toLocaleUpperCase())}\n\n${[text, sum].filter(t => t.length > 0).join(' ▸ ')}`);
            return ['complete', await i.editReply({ embeds: [embed] })];
        }
    }

    export namespace MARK {
        const PERIOD_MS = 120_000;

        const resolve_hex = async ({ roles }: GuildMember, set: Role[]) => {
            await roles.remove(HEX_CHAIN);
            await roles.add(set, 'Afflicted.');
        };

        const sequence = ({ roles }: GuildMember, pool: Collection<string, Role>): [next: Role | null, end: boolean] => {
            const curr = roles.cache.find(({ id }) => HEX_CHAIN.includes(id));
            if (!curr) return [pool.get(HEX_CHAIN[0]) || raise('Null initial hex.'), false]; // yet to hex.

            const next = HEX_CHAIN[Math.min(HEX_CHAIN.indexOf(curr.id) + 1, HEX_CHAIN.length)];
            return next === curr.id ? [null, true] : [pool.get(next) || raise('Null subsequent hex.'), false]; // final hex, or upgradable.
        };

        export const data = new SlashCommandBuilder().setName('mark')
        .setDescription('Set a curse-mark on a person.')
        .addUserOption(o => o.setName('who').setDescription('The target.').setRequired(true))
        .addStringOption(o => o.setName('why').setDescription('What did they do this time?'));

        export const execute: APPC_RESULT_FUNC = async i => {
            const targ = i.options.getMember('who') as GuildMember;
            if (targ.user.bot) return ['complete', await reply(i, true, `${targ} cannot be hexed; they're a bot.`)];

            const guild = i.guild ?? raise('Null guild.');
            const [next_hex, last_hex] = sequence(targ, guild.roles.cache.filter((_, k) => HEX_CHAIN.includes(k)));
            if (last_hex) return ['complete', await reply(i, true, `${targ} cannot be hexed any further.`)];

            //#region Create the embed.
            const embed = new EmbedBuilder()
            .setColor(0xc0c0c0)
            .setDescription(`${targ} is about to be ${next_hex}.`)
            .setAuthor({ name: `GUILTY 💀, OR INNOCENT 😇`, iconURL: targ.displayAvatarURL() });
            const reason = i.options.getString('why');
            if (reason) embed.addFields({ name: 'Reason', value: reason });
            //#endregion

            //#region Create the select menu.
            const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder()
                .setCustomId(`mark-${Date.now()}`)
                .setPlaceholder('...')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                    .setLabel('💀 Guilty!')
                    .setValue('Y'), 
                    new StringSelectMenuOptionBuilder()
                    .setLabel('😇 Innocent!')
                    .setValue('N'))
            );
            //#endregion

            await reply(i, true);
            const message = await (i.channel as TextChannel).send({ 
                allowedMentions: { parse: ['roles'], repliedUser: false },
                content: `${roleMention(MURDIST)} Poll ends soon!`,
                components: [row],
                embeds: [embed]
            });

            const collector = message.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: PERIOD_MS });
            collector.on('end', async (data, reason) => {
                try {
                    if ('messageDelete' == reason) return await (message.channel as TextChannel).send(`${targ} has been freed from malicious intent.`);

                    const box = { size_y: 0, size_n: 0, bits: [''] };
                    for (const [_, { values }] of data) {
                        switch (values[0]) {
                            case 'Y': box.size_y += 1; break;
                            case 'N': box.size_n += 1; break;
                        }
                    }
    
                    const unvoted = box.size_y <= 0 && box.size_n <= 0;
                    if (unvoted || 1 <= (box.size_y - box.size_n)) {
                        const grouping = guild.roles.cache.get(MARKED) || raise('Null curse-marked grouping.');
                        box.bits.push(`By ${unvoted ? 'default' : 'majority'}, ${targ} is now ${next_hex!}.`);

                        //#region If the cursemark can affect someone else, validate as such.
                        const assign_to = [targ];
                        if (sabotager_role(next_hex!.id) && random() >= 0.75) {
                            const hex_cap = HEX_CHAIN.slice(0, HEX_CHAIN.indexOf(next_hex!.id)); // end-index exclusion.
                            const infected = grouping.members.filter(m => m.id != targ.id && m.roles.cache.hasAny(...hex_cap)).random()!;

                            box.bits.push(`${infected} has also been afflicted due to the nature of the curse.`);
                            assign_to.push(infected);
                        }
                        for (const m of assign_to) await resolve_hex(m, [grouping, next_hex!]);
                        //#endregion
                    } else box.bits.push(`${targ} survives.`);
    
                    await message.edit({
                        components: [],
                        embeds: [embed.setDescription(box.bits.join(' ').trim() + '\n').setColor(next_hex!.color)]
                    });
                } catch (ex) {
                    Logger.to_logs_sc(i, ['error', message, ex]);
                    message.delete();
                }
            });

            await i.deleteReply();
            return ['complete', message];
        };
    }
}

// namespace GGZ {
//     export namespace STATUS {
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
//         })(i.member as GuildMember || raise('Null GuildMember.'));
//     }
// }

export const DATASET = [HEX.PRAY.data, HEX.MARK.data, MOD.MUTE.data].map(d => d.toJSON());
export const EXECUTE = (i: ChatInputCommandInteraction): Promise<Logger.APPCOMMAND_RESULT> => {
    switch (i.commandName) {
        case 'mark':    return HEX.MARK.execute(i);
        case 'pray':    return HEX.PRAY.execute(i);
        case 'mute':    return MOD.MUTE.execute(i);
    }
    return raise('Command not implemented.');
};