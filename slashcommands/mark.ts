import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, SlashCommandBuilder, bold, roleMention, time } from 'discord.js';
import { Logger, arbit, throwexc } from '../utils';
import { CM_SEQUENCE, ROLE_CM, TFRAME_MSECS } from '../constants';

export const data = new SlashCommandBuilder().setName('mark')
.setDescription('Time to incite some jealousy.')
.addUserOption(o => o.setName('user').setDescription('The victim.').setRequired(true))
.addStringOption(o => o.setName('reason').setDescription('Would you like to say why?'));

export const execute = async (i: ChatInputCommandInteraction) => (async guild => {
    if (global.bCursePend) { await i.reply({ ephemeral: true, content: 'Only one marking at a time.' }); return; }

    const victim = guild.members.resolve(i.options.getUser('user', true)) || throwexc('Null user.');
    if (victim.user.bot) { await i.reply({ content: 'Cursing a bot is not allowed.' }); return; }

    const roles = await guild.roles.fetch()
    , cmnw = victim.roles.cache.find((_, k) => CM_SEQUENCE.includes(k))
    , cmnx = roles.get(CM_SEQUENCE[!cmnw ? 0 : Math.min(CM_SEQUENCE.length - 1, CM_SEQUENCE.indexOf(cmnw.id) + 1)]) || throwexc('Null next role.');
    if (cmnw?.id === CM_SEQUENCE.at(-1)) { await i.reply({ ephemeral: true, content: `${victim} is on the final cursemark.` }); return; }

    const options = ['💀', '👍']
    , embed = new EmbedBuilder()
    .setColor(cmnx.color)
    .setDescription(`${victim} is about to be ${cmnx}`)
    .setAuthor({ name: 'GUILTY 💀 OR INNOCENT 👍', iconURL: victim.displayAvatarURL() });
    (rsn => rsn && embed.addFields({ name: 'Reported Crime', value: rsn }) || {})(i.options.getString('reason'));

    await i.reply({ ephemeral: true, content: '⏳' });
    const msg = await i.channel!.send({ 
        content: `${roleMention(ROLE_CM.GROUP)} Poll ends ${time( Math.trunc((Date.now() + TFRAME_MSECS) / 1_000), 'T' )}`
        , allowedMentions: { parse: ['roles'], repliedUser: false } 
        , embeds: [embed]
    });
    options.forEach(async r => await msg.react(r));

    //#region Create interaction collector
    const collector = msg.createReactionCollector({ filter: (r, u) => !u.bot && options.includes(r.emoji.name || ''), time: TFRAME_MSECS });
    collector.on('collect', (r, u) => msg.reactions.resolve(r.emoji.name === '💀' ? '👍' : '💀')!.users.remove(u));
    collector.on('end', async (c, r) => {
        try {
            global.bCursePend = false;
            if (r === 'messageDelete') return await msg.channel.send(`The imminent curse on ${victim} has been wiped.`);
            
            const result = ((ysz, nsz) => ({
                unvoted: ysz <= 0 &&  nsz <= 0, sway: ysz - nsz, outcome: [bold(`${ysz} voted YES, ${nsz} voted NO`) + '\n']
            }))((c.find(e => e.emoji.name === '💀')?.count || 1) - 1, (c.find(e => e.emoji.name === '👍')?.count || 1) - 1);
            
            if (result.unvoted || result.sway > 0) {
                const grouper = roles.get(ROLE_CM.MARKD) || throwexc('Null grouper.')
                , changetier = async (gm: GuildMember) => {
                    await gm.roles.remove(CM_SEQUENCE);
                    await gm.roles.add([cmnx, grouper], 'Impacted by marking poll.');
                };

                result.outcome.push(`By ${result.unvoted ? 'default' : 'majority vote'}, ${victim} is now ${cmnx}.`);
                if (CM_SEQUENCE.slice(1, -1).includes(cmnx.id) && arbit()[0] >= 0.75) {
                    // Filter guild members that are not the victim themselves, and not any of the higher tiers.
                    const infect = grouper.members.filter(gm => gm !== victim && !gm.roles.cache.hasAny(ROLE_CM.SHADE, cmnx.id === ROLE_CM.KISMT ? ROLE_CM.KISMT : ROLE_CM.SHADE)).random()!;
                    result.outcome.push(`${infect} is also converted due collateral.`);
                    for (const gm of [victim, infect]) await changetier(gm);
                } else await changetier(victim);
            } else result.outcome.push(`${victim} survives.`);
            await Promise.all([ msg.reactions.removeAll(), msg.edit({ content: roleMention(ROLE_CM.GROUP), embeds: [embed.setDescription(result.outcome.join(' ') + '\n')] }) ]);
        } catch (ex) { Logger.write(ex) }
    });
    //#endregion

    await i.deleteReply();
    global.bCursePend = true;
})(i.guild || throwexc('Null guild.'));