import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, bold, roleMention, time, userMention } from 'discord.js';
import { DM_ROLES, MURDIST_ID, TIME_LIMIT_S } from '../utils/constants.mjs';
import { crandom } from '../utils/common.mjs';

export const data = new SlashCommandBuilder()
.setName('mark')
.setDescription('Who would you like to curse this time?')
.addUserOption(option => option.setName('user').setDescription('The user to be cursed.').setRequired(true))
.addStringOption(option => option.setName('reason').setDescription('A specific reason to curse this user.'));

export const execute = async (/** @type {ChatInputCommandInteraction} */ i) => {
    if ('blocked' in global) return await i.reply({ content: 'Another mark is in progress. Please try again later.', ephemeral: true });

    const roles     = i.guild.roles.cache
    , collateral    = roles.filter(r => [DM_ROLES.DEATH, DM_ROLES.CANCER, DM_ROLES.SCARLET, DM_ROLES.KISMET]).flatMap(r => r.members)
    , victim        = i.guild.members.resolve(i.options.getUser('user'));
    if (victim.user.bot) return await i.reply('You cannot curse a bot user.');

    const next_tier = (/** @type {string=} */ now) => {
        if (now === DM_ROLES.SCARLET) {
            const kt = roles.find(r => r.id === DM_ROLES.KISMET) || (_ => { throw Error('Kismet Marked role retrieval returned undefined.') })();
            return kt.members.size < 2 ? DM_ROLES.KISMET : DM_ROLES.GREYED;
        }
        else return now === DM_ROLES.KISMET ? DM_ROLES.GREYED   :
                    now === DM_ROLES.CANCER ? DM_ROLES.SCARLET  :
                    now === DM_ROLES.DEATH  ? DM_ROLES.CANCER   :
                    DM_ROLES.DEATH;
    };

    //#region Identify current and upcoming tier of the curse.
    const tier = victim.roles.cache.find(r => Object.values(DM_ROLES).includes(r.id));
    if (tier?.id === DM_ROLES.GREYED) return await i.reply({ content: `The ${roleMention(DM_ROLES.GREYED)} status is the final stage of the curse.`, ephemeral: true });
    const next = roles.find(r => r.id === next_tier(tier?.id)) || (_ => { throw Error(`Next tier role retrieval returned undefined.`) })();
    //#endregion

    //#region Create and reply with embed, and auto-react with required reactions.
    const embed = new EmbedBuilder()
    .setAuthor({ name: 'GUILTY 🆗, OR INNOCENT 🆖?' })
    .setThumbnail(victim.displayAvatarURL())
    .setDescription(`${userMention(victim.id)} is about to be ${roleMention(next.id)}.`)
    .setColor(next.color)
    .addFields({ name: 'Reason', value: i.options.getString('reason') || 'None provided.' })
    , fetch = await i.reply({
        content: `${roleMention(MURDIST_ID)} Vote ends ${time(Math.floor(Date.now() / 1_000) + TIME_LIMIT_S, 't')}`,
        allowedMentions: { parse: ['roles'], repliedUser: false },
        embeds: [embed],
        fetchReply: true
    });
    await Promise.all([ fetch.react('🆗'), fetch.react('🆖') ]);
    //#endregion

    try { // Try-catch specifically to remove the global-linked variable.
        global.blocked = true;

        const collector = fetch.createReactionCollector({ filter: (react, user) => !user.bot && ['🆗', '🆖'].includes(react.emoji.name), time: TIME_LIMIT_S * 1_000 });
        collector.on('collect', (react, user) => { fetch.reactions.resolve(react.emoji.name === '🆗' ? '🆖' : '🆗').users.remove(user); });
        collector.on('end', async (reacts, reason) => {
            if (reason === 'messageDelete') { delete global.blocked; return await fetch.channel.send(`The imminent curse on ${userMention(victim.id)} has been wiped.`); }

            const model = (_ => {
                const count_reacts = (set, react) => Math.max(0, (set.find(r => r.emoji.name === react)?.count || 0) - 1) // one reaction is from the bot for convenience of emoji access.
                , ysize = count_reacts(reacts, '🆗')
                , nsize = count_reacts(reacts, '🆖');
                return { unvoted: ysize === 0 && nsize === 0, sway: ysize - nsize, outcome: [`${bold(ysize)} 🆗 and ${bold(nsize)} 🆖.\n`] }; 
            })();
            if (model.unvoted || model.sway > 0) {
                const replace_tier = async (member) => { await victim.roles.remove(Object.values(DM_ROLES)); await member.roles.add(next); };
                model.outcome.push(`By ${model.unvoted ? 'default' : 'majority vote'}, ${userMention(victim.id)} is now ${roleMention(next.id)}.`);
                if ([ DM_ROLES.KISMET, DM_ROLES.SCARLET ].includes(next.id) && crandom() >= 0.5) {
                    /** Filter users that are (1) not the victim themselves, and (2) not a Kismet Marked if the victim is Scarlet Marked. */
                    const single = collateral.filter(gm => gm.id !== victim.id && (tier?.id === DM_ROLES.SCARLET ? !gm.roles.cache.has(DM_ROLES.KISMET) : true)).random(1)[0];
                    model.outcome.push(`As collateral, ${userMention(single.id)} has also been converted.`);
                    for (let gm of [victim, single]) await replace_tier(gm);
                } else await replace_tier(victim);
            }
            else model.outcome.push(`${userMention(victim.id)} survives this mark for now.`);
            await Promise.all([ fetch.edit({ embeds: [embed.setDescription(model.outcome.join(' '))] }), fetch.reactions.removeAll() ]);
            delete global.blocked;
        });
    } catch (err) { delete global.blocked; throw err; }
}