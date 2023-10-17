import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, roleMention, userMention, time, bold, GuildMember } from 'discord.js';
import { DM_ROLES, TFRAME_SECONDS } from '../constants';
import { throwexc, random, pollnew } from '../utils';


export default {
    data: new SlashCommandBuilder()
    .setName('mark')
    .setDescription('Who would you like to curse this time?')
    .addUserOption(o => o.setName('user').setDescription('The user to be cursed.').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('A reason to curse this user.')),

    execute: async (i: ChatInputCommandInteraction) => {
        if (global.noStack) return await i.reply({ content: 'Mark in progress. Please try again later.', ephemeral: true });

        const roles = i.guild!.roles.cache, victim = i.guild!.members.resolve(i.options.getUser('user')!) || throwexc('GuildMember undefined.');
        if (victim.user.bot) return await i.reply('You cannot curse a bot user.');
        
        //#region Get the current tier and next tier, as well as the grouping role if applicable.
        const now = victim.roles.cache.find(r => [ DM_ROLES.DEATH, DM_ROLES.CANCR, DM_ROLES.SCARL, DM_ROLES.KISMT, DM_ROLES.GREYD ].includes(r.id))
        , next = (i => roles.get(i === DM_ROLES.GREYD && i 
            || i === DM_ROLES.KISMT && DM_ROLES.GREYD
            || i === DM_ROLES.SCARL && (roles.get(DM_ROLES.KISMT)!.members.size < 2 && DM_ROLES.KISMT || DM_ROLES.GREYD)
            || i === DM_ROLES.CANCR && DM_ROLES.SCARL
            || i === DM_ROLES.DEATH && DM_ROLES.CANCR
            || DM_ROLES.DEATH))(now?.id)
        || throwexc('Next tier retrieval undefined.');
        if (now?.id === DM_ROLES.GREYD) return await i.reply({ content: `${userMention(victim.id)} is at the final stage of the cursemark.`, ephemeral: true });
        //#endregion

        //#region Embed creation
        const embed = new EmbedBuilder()
        .setAuthor({ name: 'GUILTY 💀, OR INNOCENT 😇' })
        .setThumbnail(victim.displayAvatarURL())
        .setDescription(`${userMention(victim.id)} is about to be ${roleMention(next.id)}.`)
        .setColor(next.color)
        .addFields({ name: 'Reason', value: i.options.getString('reason') || '---' });
        //#endregion

        //#region Reply ephemeral to separate the poll from the caller, then delete the reply.
        const collector = await pollnew(i
            , TFRAME_SECONDS * 1_000
            , { content: `${roleMention(DM_ROLES.CROWD)} Vote ends ${time(Math.floor(Date.now() / 1_000) + TFRAME_SECONDS, 't')}`, embeds: [embed] }
            , {
                '💀': async (_, u) => await collector.message.reactions.resolve('😇')?.users.remove(u),
                '😇': async (_, u) => await collector.message.reactions.resolve('💀')?.users.remove(u)
            });
        //#endregion

        try { // Try-catch specifically to change the global-linked variable.
            global.noStack = true;
            collector.on('end', async (c, r) => {
                global.noStack = false;
                if (r === 'messageDelete') { global.noStack = false; return await collector.message.channel.send(`The imminent curse on ${userMention(victim.id)} has been wiped.`); }

                const result = (() => {
                    const ysize = c.find(e => e.emoji.name === '💀')?.count || 0, nsize = c.find(e => e.emoji.name === '✔️')?.count || 0;
                    return { unvoted: ysize <= 0 && nsize <= 0, sway: ysize - nsize, outcome: [`${bold(ysize.toString())} 🆗 and ${bold(nsize.toString())} 🆖.\n`] };
                })();
                if (result.unvoted || result.sway > 0) {
                    const grouper = roles.get(DM_ROLES.MARKD) || throwexc('Cursemarked group role undefined.')
                    , changetier = async (member: GuildMember) => {
                        await member.roles.remove(Object.keys(DM_ROLES).filter(r => ![DM_ROLES.CROWD].includes(r)));
                        for (const tier of [DM_ROLES.DEATH, DM_ROLES.CANCR, DM_ROLES.SCARL, DM_ROLES.KISMT]) await member.roles.remove(tier);
                        for (const into of [next, grouper]) await member.roles.add(into);
                    };

                    result.outcome.push(`By ${result.unvoted && 'default' || 'majority vote'}, ${userMention(victim.id)} is now ${roleMention(next.id)}.`);
                    if ([ DM_ROLES.KISMT, DM_ROLES.SCARL ].includes(next.id) && random() >= 0.5) {
                        /** Filter users that are (1) not the victim themselves, and (2) not a Kismet Marked if the victim is Scarlet Marked. */
                        const single = grouper.members.filter(gm => gm.id !== victim.id && [DM_ROLES.GREYD, now?.id === DM_ROLES.SCARL && DM_ROLES.KISMT || DM_ROLES.GREYD].some(rid => !gm.roles.cache.has(rid))).random(1)[0];
                        result.outcome.push(`As collateral, ${userMention(single.id)} has also been converted.`);
                        for (const gm of [victim, single]) changetier(gm);
                    } else changetier(victim);
                } else result.outcome.push(`${userMention(victim.id)} survives this mark for now.`);
                await Promise.all([ collector.message.reactions.removeAll(), collector.message.edit({ content: roleMention(DM_ROLES.CROWD), embeds: [embed.setDescription(result.outcome.join(' '))] }) ]);
            });
        } catch (err) { global.noStack = false; throw err; }
    }
}