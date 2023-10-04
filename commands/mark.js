import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, SlashCommandBuilder, bold, roleMention, time, userMention } from 'discord.js';
import { DM_ROLES, TFRAME_SECONDS } from '../constants.js';
import { Common } from '../utils.js';

export default {
    data: new SlashCommandBuilder()
    .setName('mark')
    .setDescription('Who would you like to curse this time?')
    .addUserOption(o => o.setName('user').setDescription('The user to be cursed.').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('A reason to curse this user.')),

    execute: async (/** @type {ChatInputCommandInteraction} */ i) => {
        if ('blocked' in global) return await i.reply({ content: 'Mark in progress. Please try again later.', ephemeral: true });

        const roles = i.guild.roles.cache
        , grouper = roles.get(DM_ROLES.MARKD) || (() => { throw Error('Cursemarked role undefined.') })()
        , victim = i.guild.members.resolve(i.options.getUser('user'));
        if (victim.user.bot) return await i.reply('You cannot curse a bot user.');
        
        //#region Get the current tier and next tier, as well as the grouping role if applicable.
        const now = victim.roles.cache.find(r => [ DM_ROLES.DEATH, DM_ROLES.CANCR, DM_ROLES.SCARL, DM_ROLES.KISMT, DM_ROLES.GREYD ].includes(r.id))
        , next = (i => roles.get(i === DM_ROLES.GREYD && i 
            || i === DM_ROLES.KISMT && DM_ROLES.GREYD
            || i === DM_ROLES.SCARL && (roles.get(DM_ROLES.KISMT).members.size < 2 && DM_ROLES.KISMT || DM_ROLES.GREYD)
            || i === DM_ROLES.CANCR && DM_ROLES.SCARL
            || i === DM_ROLES.DEATH && DM_ROLES.CANCR
            || DM_ROLES.DEATH))(now?.id)
        || (() => { throw Error('Next tier retrieval undefined.') })();
        if (now?.id === DM_ROLES.GREYD) return await i.reply({ content: `${userMention(victim.id)} is at the final stage of the cursemark.`, ephemeral: true });
        //#endregion

        //#region Create and reply with embed, and auto-react with required reactions.
        const embed = new EmbedBuilder()
        .setAuthor({ name: 'GUILTY 🆗, OR INNOCENT 🆖?' })
        .setThumbnail(victim.displayAvatarURL())
        .setDescription(`${userMention(victim.id)} is about to be ${roleMention(next.id)}.`)
        .setColor(next.color)
        .addFields({ name: 'Reason', value: i.options.getString('reason') || 'None provided.' })
        , fetch = await i.reply({
            content: `${roleMention(DM_ROLES.CROWD)} Vote ends ${time(Math.floor(Date.now() / 1_000) + TFRAME_SECONDS, 't')}`,
            allowedMentions: { parse: ['roles'], repliedUser: false },
            embeds: [embed],
            fetchReply: true
        });
        await Promise.all([ fetch.react('🆗'), fetch.react('🆖') ]);
        //#endregion
    
        //#region Try-catch specifically to remove the global-linked variable.
        try {
            global.blocked = true;

            const collector = fetch.createReactionCollector({ filter: (react, user) => !user.bot && ['🆗', '🆖'].includes(react.emoji.name), time: TFRAME_SECONDS * 1_000 });
            collector.on('collect', (react, user) => { fetch.reactions.resolve(react.emoji.name === '🆗' ? '🆖' : '🆗').users.remove(user); });
            collector.on('end', async (reacts, reason) => {
                if (reason === 'messageDelete') { delete global.blocked; return await fetch.channel.send(`The imminent curse on ${userMention(victim.id)} has been wiped.`); }

                const model = (() => {
                    const count_reacts = (set, react) => Math.max(0, (set.find(r => r.emoji.name === react)?.count || 0) - 1) // remove bot reaction used for convenience of emoji access.
                    , ysize = count_reacts(reacts, '🆗')
                    , nsize = count_reacts(reacts, '🆖');
                    return { unvoted: ysize === 0 && nsize === 0, sway: ysize - nsize, outcome: [`${bold(ysize)} 🆗 and ${bold(nsize)} 🆖.\n`] }; 
                })();
                if (model.unvoted || model.sway > 0) {
                    const migrateMember = async (/** @type {GuildMember} */ member) => {
                        for (const away of [now, next.id === DM_ROLES.GREYD && grouper || undefined].filter(r => r)) await member.roles.remove(away);
                        for (const into of [next, !now && grouper || undefined].filter(r => r)) await member.roles.add(into);
                    };

                    model.outcome.push(`By ${model.unvoted ? 'default' : 'majority vote'}, ${userMention(victim.id)} is now ${roleMention(next.id)}.`);
                    if ([ DM_ROLES.KISMT, DM_ROLES.SCARL ].includes(next.id) && Common.random() >= 0.5) {
                        /** Filter users that are (1) not the victim themselves, and (2) not a Kismet Marked if the victim is Scarlet Marked. */
                        const single = grouper.members.filter(gm => gm.id !== victim.id && (now?.id === DM_ROLES.SCARL && !gm.roles.has(DM_ROLES.KISMT) || true)).random(1)[0];
                        model.outcome.push(`As collateral, ${userMention(single.id)} has also been converted.`);
                        for (const gm of [victim, single]) migrateMember(gm);
                    } else migrateMember(victim);
                } else model.outcome.push(`${userMention(victim.id)} survives this mark for now.`);
                await Promise.all([ fetch.edit({ embeds: [embed.setDescription(model.outcome.join(' '))] }), fetch.reactions.removeAll() ]);
                delete global.blocked;
            });
        } catch (err) { delete global.blocked; throw err; }
        //#endregion
    }
}