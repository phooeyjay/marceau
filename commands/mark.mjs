import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, bold, roleMention, time, userMention } from 'discord.js';
import { DM_ROLES, MURDIST_ID, TIME_LIMIT_S } from '../utils/constants.mjs';
import { crandom } from '../utils/common.mjs';

const next_tier = async (/** @type {string=} */ now, /** @type {ChatInputCommandInteraction} */ i) => {
    if (now === DM_ROLES.SCARLET) {
        const kismet = await i.guild.roles.fetch(DM_ROLES.KISMET) || (_ => { throw Error('Failed to fetch Kismet Marked role from interaction data.') })();
        return kismet && kismet.members.size < 2 ? DM_ROLES.KISMET : DM_ROLES.GREYED;
    }
    else return now === DM_ROLES.KISMET ? DM_ROLES.GREYED   :
                now === DM_ROLES.CANCER ? DM_ROLES.SCARLET  :
                now === DM_ROLES.DEATH ? DM_ROLES.CANCER    :
                DM_ROLES.DEATH;
}

export const data = new SlashCommandBuilder()
.setName('mark')
.setDescription('Who would you like to curse this time?')
.addUserOption(option => option.setName('user').setDescription('The user to be cursed.').setRequired(true))
.addStringOption(option => option.setName('reason').setDescription('A specific reason to curse this user.'));

export const execute = async (/** @type {ChatInputCommandInteraction} */ interaction) => {
    try {
        if ('blocked' in global) return await interaction.reply({ content: 'Another mark is in progress. Please try again later.', ephemeral: true });

        const victim = interaction.guild.members.resolve(interaction.options.getUser('user'));
        if (victim.user.bot) return await interaction.reply('You cannot curse a bot user.');
    
        //#region Identify the current tier of the curse and its subsequent.
        const tier = victim.roles.cache.find(role => Object.values(DM_ROLES).includes(role.id)); // Undefined means the person hasn't been marked yet.
        if (tier?.id === DM_ROLES.GREYED) return await interaction.reply({ content: `The ${roleMention(DM_ROLES.GREYED)} status is the final stage of the curse.`, ephemeral: true });
        const next = await interaction.guild.roles.fetch(await next_tier(tier?.id, interaction)) || (_ => { throw Error('Unable to fetch the next tier of the curse.') })();
        //#endregion
    
        //#region Create and reply with embed, and auto-react with required reactions.
        const embed = new EmbedBuilder()
        .setAuthor({ name: 'GUILTY 🆗, OR INNOCENT 🆖?' })
        .setThumbnail(victim.displayAvatarURL())
        .setDescription(`${userMention(victim.id)} is about to be ${next.id === DM_ROLES.GREYED ? bold('KILLED') : roleMention(next.id)}.`)
        .setColor(next.color)
        .addFields({ name: 'Reason', value: interaction.options.getString('reason') || 'None provided.' })
        , fetch = await interaction.reply({
            content: `${roleMention(MURDIST_ID)} Vote ends ${time(Math.floor(Date.now() / 1_000) + TIME_LIMIT_S, 't')}`,
            allowedMentions: { parse: ['roles'], repliedUser: false },
            embeds: [embed],
            fetchReply: true
        });
        await Promise.all([ fetch.react('🆗'), fetch.react('🆖') ]);
        //#endregion
    
        global.blocked = true; // created, and then deleted after.
        const collector = fetch.createReactionCollector({ filter: (react, user) => !user.bot && ['🆗', '🆖'].includes(react.emoji.name), time: TIME_LIMIT_S * 1_000 });
        collector.on('collect', (react, user) => { fetch.reactions.resolve(react.emoji.name === '🆗' ? '🆖' : '🆗').users.remove(user); });
        collector.on('end', async (reacts, reason) => {
            if (reason === 'messageDelete') {
                delete global.blocked; return await fetch.channel.send(`The imminent curse on ${userMention(victim.id)} has been wiped.`);
            }
    
            const model = (_ => {
                const count_reacts = (set, react) => {
                    let subset = set.find(r => r.emoji.name === react);
                    return !subset ? 0 : Math.max(0, subset.count - 1); // one reaction is from the bot for convenience of emoji access.
                };
                let ysize = count_reacts(reacts, '🆗'), nsize = count_reacts(reacts, '🆖');
                return { unvoted: ysize === 0 && nsize === 0, sway: ysize - nsize, outcome: [`${bold(ysize)} 🆗 and ${bold(nsize)} 🆖.\n`] }; 
            })();
            if (model.unvoted || model.sway > 0) {
                const replace_tier = async (member, tier) => { await member.roles.remove(Object.values(DM_ROLES)); await member.roles.add(tier); };
                model.outcome.push(`By ${model.unvoted ? 'default' : 'majority vote'}, ${userMention(victim.id)} is now ${roleMention(next.id)}.`);
                if ([ DM_ROLES.KISMET, DM_ROLES.SCARLET ].includes(next.id) && crandom() >= 0.5) {
                    const selection = [DM_ROLES.DEATH, DM_ROLES.CANCER, tier?.id === DM_ROLES.KISMET ? DM_ROLES.SCARLET : undefined].filter(dmr => dmr),
                        collateral = fetch.guild.members.cache.filter(m => m.id !== victim.id && !m.user.bot && m.roles.cache.find(r => selection.includes(r.id))).random(1)[0];
                    if (collateral) model.outcome.push(`As collateral, ${userMention(collateral.id)} has also been converted.`);
                    for (let gm of [victim, collateral].filter(m => m)) await replace_tier(gm, next);
                }
                else await replace_tier(victim, next);
            }
            else model.outcome.push(`${userMention(victim.id)} survives this mark, for now.`);
            delete global.blocked;
            await Promise.all([ fetch.edit({ embeds: [embed.setDescription(model.outcome.join(' '))] }), fetch.reactions.removeAll() ]);
        });
    }
    catch (err) { delete global.blocked; throw err; }
}