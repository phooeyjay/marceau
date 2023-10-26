/**
 * Landing file to export layout and process handling for ApplicationCommands.
 */
import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, SlashCommandBuilder, bold, inlineCode, roleMention, time } from 'discord.js';
import { Logger, arbit, throwexc } from './utils';
import { ROLE_CM, TFRAME_MSECS } from './constants';

//#region PRIVATE VARIABLES
const CM_SEQ = [ROLE_CM.DEATH, ROLE_CM.SCARL, ROLE_CM.KISMT, ROLE_CM.SHADE];
//#endregion

export const dataset = [
    new SlashCommandBuilder().setName('mark')
    .setDescription('Who would you like to curse this time?')
    .addUserOption(o => o.setName('user').setDescription('The user to be cursed.').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('A reason to curse this user.')).toJSON()

    , new SlashCommandBuilder().setName('mute')
    .setDescription('Somebody needs to shut up for a while.')
    .addUserOption(o => o.setName('user').setDescription('The user.').setRequired(true))
    .addNumberOption(o => o.setName('hours').setDescription('The mute period.').setRequired(true)).toJSON()

    , new SlashCommandBuilder().setName('pray')
    .setDescription('The confessional is in session.').toJSON()
];

export const route = async (name: string, i: ChatInputCommandInteraction) => {
    switch (name) {
        default: throwexc(`ApplicationCommand [${name}] not implemented.`);

        case 'mark': {
            if (global.blMarkOngoing) { await i.reply({ ephemeral: true, content: 'Multiple marks cannot happen at the same time.' }); return; }

            const victim = i.guild!.members.resolve(i.options.getUser('user', true)) || throwexc('Unresolvable [user]')
            , rolelist = i.guild!.roles.cache;
            if (victim.user.bot) { await i.reply({ content: 'Can\'t curse a bot user.' }); return; }
        
            //#region Get the current mark, and its subsequent.
            const cmnow = victim.roles.cache.find((_, k) => CM_SEQ.includes(k))
            , cmnxt = rolelist.get(CM_SEQ[!cmnow ? 0 : Math.min(CM_SEQ.length - 1, CM_SEQ.indexOf(cmnow.id) + 1)]) || throwexc('Unresolvable [cmnxt]');
            if (cmnow?.id === CM_SEQ.at(-1)) { await i.reply({ ephemeral: true, content: `${victim} is on the final cursemark.` }); return; }
            //#endregion

            const embed = new EmbedBuilder()
            .setColor(cmnxt.color)
            .setDescription(`${victim} is about to be ${cmnxt}`)
            .setAuthor({ name: 'GUILTY 💀 OR INNOCENT 👍', iconURL: victim.displayAvatarURL() })
            , allowedReactions = ['💀', '👍'];
            (reason => reason && embed.addFields({ name: 'Reported crime', value : reason }) || {})(i.options.getString('reason'));

            await i.reply({ ephemeral: true, content: 'Setting up the poll. If this message persists, please inform the Server Owner.', fetchReply: true });
            const fetch = await i.channel!.send({ 
                content: `${roleMention(ROLE_CM.GROUP)} Poll ends ${time( Math.trunc((Date.now() + TFRAME_MSECS) / 1_000), 'T' )}`
                , allowedMentions: { parse: ['roles'], repliedUser: false } 
                , embeds: [embed]
            });
            allowedReactions.forEach(async r => await fetch.react(r));
            await i.deleteReply();

            //#region Instantiate the reaction collector
            const collector = fetch.createReactionCollector({ filter: (r, u) => !u.bot && allowedReactions.includes(r.emoji.name || ''), time: TFRAME_MSECS });
            collector.on('collect', (r, u) => fetch.reactions.resolve(r.emoji.name === '💀' ? '👍' : '💀')!.users.remove(u));
            collector.on('end', async (c, r) => {
                global.blMarkOngoing = false;
                try {
                    if (r === 'messageDelete') return await fetch.channel.send(`The imminent curse on ${victim} has been wiped.`);
                    
                    const result = (() => {
                        const ysize = (c.find(e => e.emoji.name === '💀')?.count || 1) - 1, nsize = (c.find(e => e.emoji.name === '👍')?.count || 1) - 1;
                        return { unvoted: ysize <= 0 && nsize <= 0, sway: ysize - nsize, outcome: [bold(`${ysize.toString()} voted YES, ${nsize.toString()} voted NO`) + '\n'] };
                    })();
                    if (result.unvoted || result.sway > 0) {
                        const grouper = rolelist.get(ROLE_CM.MARKD) || throwexc('Unresolvable [grouper]')
                        , changetier = async (gm: GuildMember) => {
                            await gm.roles.remove(CM_SEQ);
                            await gm.roles.add([cmnxt, grouper], 'Impacted by marking poll.');
                        };
        
                        result.outcome.push(`By ${result.unvoted ? 'default' : 'majority vote'}, ${victim} is now ${cmnxt}.`);
                        if (CM_SEQ.slice(1, -1).includes(cmnxt.id) && arbit()[0] >= 0.75) {
                            // Filter guild members that are not the victim themselves, and not any of the higher tiers.
                            const infect = grouper.members.filter(gm => gm !== victim && !gm.roles.cache.hasAny(ROLE_CM.SHADE, cmnxt.id === ROLE_CM.KISMT ? ROLE_CM.KISMT : ROLE_CM.SHADE)).random()!;
                            result.outcome.push(`${infect} is also converted due collateral.`);
                            for (const gm of [victim, infect]) await changetier(gm);
                        } else await changetier(victim);
                    } else result.outcome.push(`${victim} survives.`);
                    await Promise.all([ fetch.reactions.removeAll(), fetch.edit({ content: roleMention(ROLE_CM.GROUP), embeds: [embed.setDescription(result.outcome.join(' ') + '\n')] }) ]);
                } catch (err) { Logger.plaintext(err) }
            });
            //#endregion
            global.blMarkOngoing = true;
        }; break;

        case 'mute': {
            const gm = i.guild!.members.resolve(i.options.getUser('user')!) || throwexc('GuildMember undefined.')
            , hours = i.options.getNumber('hours', true)
            , valid = hours > 0;
        
            await gm.timeout(valid ? hours * 3_600_000 : null);
            await i.reply({ ephemeral: true, content: `${gm}` + (valid ? ` > Muted for ${bold(hours + ' hours.')}` : ` > Unmuted.`) });
        }; break;
    
        case 'pray': {
            const cm = i.guild!.members.resolve(i.user)?.roles.cache.find((_, k) => CM_SEQ.includes(k) || k === ROLE_CM.GHOST);
            if (!cm) { await i.reply({ ephemeral: true, content: `You don\'t have the right role for this action.` }); return; }
        
            const fetch = await i.reply({ ephemeral: true, content: 'Awaiting consultation. If this message persists, please inform the Server Owner.', fetchReply: true });
            setTimeout(async () => {
                try {
                    const res = (() => {
                        const once = [ROLE_CM.GHOST, ROLE_CM.SHADE].includes(cm.id)
                        , carrier = CM_SEQ.slice(1, -1).includes(cm.id)
                        , diehard = cm.id === ROLE_CM.GHOST && (i.guild!.roles.cache.get(ROLE_CM.KISMT)?.members.size || 0) > 0 || cm.id === ROLE_CM.SHADE;

                        const faces = carrier ? [0, 1, 1, 3, 3, 5] : [1, 2, 3, 4, 5, 6];
                        const dist = ((impact: number[]) => {
                            const basechance = 0.990 / impact.reduce((a, b) => a + b);
                            return impact.map(n => n * basechance).map((_, ix, ar) => ar.slice(0, ix + 1).reduce((a, b) => a + b));
                        })(diehard ? [0.75, 1, 1, 1, 1, 1.75] : carrier ? [1.69, 1, 1, 1, 1, 1] : [1, 1, 1, 1, 1, 1]);

                        const end = arbit(once ? 1 : 5).map(n => faces[dist.findIndex(v => v >= n)]);
                        return { arr: `❰ ${end.map(n => n === 0 ? '💀' : n).join(', ')} ❱`, sum: end.length > 1 && end.every(n => n !== 0) ? `❰ ${end.reduce((a, b) => a + b)} ❱` : undefined };
                    })();

                    const desc = [bold(cm.name.toUpperCase()), '▸', inlineCode(res.arr), res.sum ? '▸ ' + inlineCode(res.sum) : undefined].join(' ').trim();
                    await fetch.channel.send({ content: `${i.user}`, embeds: [new EmbedBuilder().setColor(cm.hexColor).setDescription(desc)] });
                    await i.deleteReply();
                } catch (err) { Logger.plaintext(err) }
            }, 3_000);
        }; break;
    }
}