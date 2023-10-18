import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, SlashCommandBuilder, bold, roleMention, time, userMention } from 'discord.js';
import { DM_ROLES } from '../constants';
import { throwexc, random, pollnew, Logger } from '../utils';

//#region PRIVATE VARIABLES
const TFRAME_MSECS = 2 * 60 * 1_000
, TIER_SEQUENCE = [DM_ROLES.DEATH, DM_ROLES.CANCR, DM_ROLES.SCARL, DM_ROLES.KISMT, DM_ROLES.GREYD];
//#endregion

export const data = new SlashCommandBuilder()
.setName('mark')
.setDescription('Who would you like to curse this time?')
.addUserOption(o => o.setName('user').setDescription('The user to be cursed.').setRequired(true))
.addStringOption(o => o.setName('reason').setDescription('A reason to curse this user.'));

export const execute = async (i: ChatInputCommandInteraction) => {
    if (global.blMarkOngoing) return await i.reply({ content: 'Multiple marks cannot happen at the same time.', ephemeral: true, fetchReply: true });

    const victim = i.guild!.members.resolve(i.options.getUser('user')!)  || throwexc('Unresolvable [user]'), rolelist = i.guild!.roles.cache;
    if (victim.user.bot) return await i.reply({ content: 'You cannot curse a bot user.', fetchReply: true });

    //#region Get the current tier, oncoming tier, and EmbedBuilder reference.
    const tierNow = victim.roles.cache.find((_, k) => TIER_SEQUENCE.includes(k));
    if (tierNow?.id === DM_ROLES.GREYD) return await i.reply({ content: `This person is already at the final cursemark tier.`, ephemeral: true, fetchReply: true });

    const tierNxt = rolelist.get(TIER_SEQUENCE[TIER_SEQUENCE.indexOf(tierNow?.id || '') + 1]) || throwexc('[tierNxt] could not resolve.') // Assumed GREYD has already been interrupted prior.
    , embed = new EmbedBuilder()
    .setAuthor({ name: 'GUILTY 💀, OR INNOCENT 😇' })
    .setThumbnail(victim.displayAvatarURL())
    .setDescription(`${userMention(victim.id)} is about to be ${bold(tierNxt.name.toUpperCase())}.`)
    .setColor(tierNxt.color)
    .addFields({ name: 'Reason', value: i.options.getString('reason') || '---' });
    //#endregion

    const collector = await pollnew(i
    , TFRAME_MSECS
    , { content: `${roleMention(DM_ROLES.CROWD)} Poll ends ${time( Math.round((Date.now() + TFRAME_MSECS) / 1_000), 't' )}`, embeds: [embed] }
    , {
        '💀': async (_, u) => await collector.message.reactions.resolve('😇')?.users.remove(u),
        '😇': async (_, u) => await collector.message.reactions.resolve('💀')?.users.remove(u)  
    });
    collector.on('end', async (c, r) => {
        try {
            global.blMarkOngoing = false;
            if (r === 'messageDelete') { global.blMarkOngoing = false; return await collector.message.channel.send(`The imminent curse on ${userMention(victim.id)} has been wiped.`); }

            const result = (() => {
                const ysize = (c.find(e => e.emoji.name === '💀')?.count || 1) - 1, nsize = (c.find(e => e.emoji.name === '😇')?.count || 1) - 1;
                return { unvoted: ysize <= 0 && nsize <= 0, sway: ysize - nsize, outcome: [`${bold(ysize.toString() + ' YES')} and ${bold(nsize.toString() + ' NO')}.\n`] };
            })();
            if (result.unvoted || result.sway > 0) {
                const grouper = rolelist.get(DM_ROLES.MARKD) || throwexc('Unresolvable [grouper]')
                , changetier = async (gm: GuildMember) => {
                    await gm.roles.remove(TIER_SEQUENCE);
                    await gm.roles.add([tierNxt.id, grouper.id], 'Impacted by marking poll.');
                };

                result.outcome.push(`By ${result.unvoted ? 'default' : 'majority vote'}, ${userMention(victim.id)} is now ${bold(tierNxt.name.toUpperCase())}.`);
                if ([ DM_ROLES.SCARL, DM_ROLES.KISMT ].includes(tierNxt.id) && random() >= 0.5) {
                    // Filter guild members that are not the victim themselves, and not any of the higher tiers.
                    const infect = grouper.members.filter(gm => gm.id !== victim.id && !gm.roles.cache.hasAny(DM_ROLES.GREYD, tierNxt.id === DM_ROLES.KISMT ? DM_ROLES.KISMT : DM_ROLES.GREYD)).random()!;
                    result.outcome.push(`As collateral, ${userMention(infect.id)} has also been carried over.`);
                    for (const gm of [victim, infect]) await changetier(gm);
                } else await changetier(victim);
            } else result.outcome.push(`${userMention(victim.id)} survives the mark!`);
            await Promise.all([
                collector.message.reactions.removeAll(), 
                collector.message.edit({ content: roleMention(DM_ROLES.CROWD), embeds: [embed.setDescription(result.outcome.join(' '))] }) 
            ]);
        }
        catch (err) { Logger.basic(err) }
    });

    global.blMarkOngoing = true;
    return collector.message;
};