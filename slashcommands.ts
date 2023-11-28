import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, SlashCommandBuilder, bold, inlineCode, roleMention, time } from 'discord.js';
import { Logger, arbit, throwexc } from './utils';
import { CM_SEQUENCE, ROLE_CM, TFRAME_MSECS } from './constants';

//#region Commands implementation
const mark = async (i: ChatInputCommandInteraction) => (async guild => {
    if (global.bCursePend) { await i.reply({ ephemeral: true, content: 'Only one marking at a time.' }); return; }

    const victim = guild.members.resolve(i.options.getUser('user', true)) || throwexc('Null user.');
    if (victim.user.bot) { await i.reply({ content: 'Cursing a bot is not allowed.' }); return; }

    const roles = await guild.roles.fetch()
    , cmnw = victim.roles.cache.find((_, k) => CM_SEQUENCE.includes(k))
    , cmnx = roles.get(CM_SEQUENCE[!cmnw ? 0 : Math.min(CM_SEQUENCE.length - 1, CM_SEQUENCE.indexOf(cmnw.id) + 1)]) || throwexc('Null next role.');
    if (cmnw?.id === CM_SEQUENCE.at(-1)) { await i.reply({ ephemeral: true, content: `${victim} is on the final cursemark.` }); return; }

    const opns = ['💀', '👍']
    , embed = new EmbedBuilder()
    .setColor(cmnx.color)
    .setDescription(`${victim} is about to be ${cmnx}`)
    .setAuthor({ name: `GUILTY ${opns[0]} OR INNOCENT ${opns[1]}`, iconURL: victim.displayAvatarURL() });
    (rsn => rsn && embed.addFields({ name: 'Reported Crime', value: rsn }) || {})(i.options.getString('reason'));

    await i.reply({ ephemeral: true, content: '⏳' });
    const msg = await i.channel!.send({ 
        content: `${roleMention(ROLE_CM.GROUP)} Poll ends ${time( Math.trunc((Date.now() + TFRAME_MSECS) / 1_000), 'T' )}`
        , allowedMentions: { parse: ['roles'], repliedUser: false } 
        , embeds: [embed]
    });
    for (const o of opns) await msg.react(o);

    //#region Create interaction collector
    const collector = msg.createReactionCollector({ filter: (r, u) => !u.bot && opns.includes(r.emoji.name || ''), time: TFRAME_MSECS });
    collector.on('collect', (r, u) => msg.reactions.resolve(opns.filter(o => o !== r.emoji.name)[0])!.users.remove(u));
    collector.on('end', async (c, r) => {
        try {
            global.bCursePend = false;
            if (r === 'messageDelete') return await msg.channel.send(`The imminent curse on ${victim} has been wiped.`);
            
            const result = ((ysz, nsz) => ({
                unvoted: ysz <= 0 &&  nsz <= 0, sway: ysz - nsz, outcome: [bold(`${ysz} voted YES, ${nsz} voted NO`) + '\n']
            }))((c.find(e => e.emoji.name === opns[0])?.count || 1) - 1, (c.find(e => e.emoji.name === opns[1])?.count || 1) - 1);

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
const pray = async (i: ChatInputCommandInteraction) => {
    const cm = (i.member as GuildMember).roles.cache.find((_, k) => CM_SEQUENCE.includes(k) || k === ROLE_CM.GHOST);
    if (!cm) { await i.reply({ ephemeral: true, content: 'Action halted; expected role missing.' }); return; }

    const msg = await i.reply({ ephemeral: true, fetchReply: true, content: '⏳' });
    setTimeout(async () => {
        try {
            const once = [ROLE_CM.GHOST, ROLE_CM.SHADE].includes(cm.id)
            , carrier = CM_SEQUENCE.slice(1, -1).includes(cm.id)
            , diehard = cm.id === ROLE_CM.GHOST && (i.guild!.roles.cache.get(ROLE_CM.KISMT)?.members.size || 0) > 0 || cm.id === ROLE_CM.SHADE;

            const faces = carrier ? [0, 1, 1, 3, 3, 5] : [1, 2, 3, 4, 5, 6];
            const dist = ((impact: number[]) => {
                const basechance = 0.990 / impact.reduce((a, b) => a + b);
                return impact.map(n => n * basechance).map((_, ix, ar) => ar.slice(0, ix + 1).reduce((a, b) => a + b));
            })(diehard ? [0.75, 1, 1, 1, 1, 1.75] : carrier ? [1.69, 1, 1, 1, 1, 1] : [1, 1, 1, 1, 1, 1]);

            const res = (a => ({
                arr: `❰ ${a.map(n => n === 0 ? '💀' : n).join(', ')} ❱`
                , sum: a.length > 1 && a.every(n => n !== 0) ? `❰ ${a.reduce((x, y) => x + y)} ❱` : null
            }))(arbit(once ? 1 : 5).map(n => faces[dist.findIndex(v => v >= n)]));

            const desc = [bold(cm.name.toUpperCase()), '▸', inlineCode(res.arr), res.sum ? '▸ ' + inlineCode(res.sum) : null].join(' ').trim();
            await msg.channel.send({ content: `${i.user}`, embeds: [new EmbedBuilder().setColor(cm.hexColor).setDescription(desc)] });
            await i.deleteReply();
        } catch (ex) { Logger.write(ex); }
    }, 3_000);
}
//#endregion

export const dataset = [
    new SlashCommandBuilder().setName('mark')
    .setDescription('Time to incite some jealousy.')
    .addUserOption(o => o.setName('user').setDescription('The victim.').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Would you like to say why?')).toJSON(),

    new SlashCommandBuilder().setName('pray')
    .setDescription('Let\'s resolve some misbeliefs.').toJSON()
];

export const execute = (input: ChatInputCommandInteraction) => (name => 
    name === 'mark' ? mark(input) 
    : name === 'pray' ? pray(input)
    : throwexc(`${name}: Unroutable command`))(input.commandName);