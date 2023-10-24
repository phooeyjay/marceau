/**
 * Landing file to export layout and process handling for ApplicationCommands.
 */
import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, SlashCommandBuilder, bold, inlineCode, roleMention, time } from 'discord.js';
import { Logger, random, throwexc } from './utils';
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
                        if (CM_SEQ.slice(1, -1).includes(cmnxt.id) && random() >= 0.75) {
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
            const cm = i.guild!.members.resolve(i.user)?.roles.cache.find((_, k) => CM_SEQ.includes(k));
            if (!cm) { await i.reply({ ephemeral: true, content: `You don\'t have the right role for this action.` }); return; }
        
            const embed = new EmbedBuilder().setColor(cm.hexColor).setDescription('System is thinking...')
            , fetch = await i.reply({ content: `${i.user}`, embeds: [embed] });

            setTimeout(async () => {
                try {
                    //#region Initiliaze the chance distribution for the rolling dice.
                    const kt = i.guild!.roles.cache.get(ROLE_CM.KISMT)
                    , chance_dist = (impact = [0, 0, 0, 0, 0, 0], faces = [1, 2, 3, 4, 5, 6]) => {
                        const remainder_dist = (0.99 - (impact = impact.map(v => v !== 0 && 0.165 + v || v)).reduce((s, n) => s + n)) / impact.filter(n => n === 0).length;
                        impact = impact.map(v => v === 0 && remainder_dist || v);
                        return faces.map((v, ix) => ({ max: impact.slice(0, ix + 1).reduce((s, n) => s + n), value: v }))
                    }
                    , chances = ((r, has) => 
                        (r === ROLE_CM.GHOST && has || r === ROLE_CM.SHADE) ? chance_dist([-0.1, 0, 0, 0, 0.05, 0.05])
                        : CM_SEQ.slice(1, -1).includes(r) ? chance_dist([0.05, 0, 0, 0, -0.0125, -0.0375], [0, 1, 2, 3, 4, 5])
                        : chance_dist([0.0375, 0.0125, 0, 0, -0.025, -0.025])
                    )(cm.id, kt && kt.members.size > 0);
                    //#endregion
                    
                    //#region Update the result display.
                    const res = (random([ROLE_CM.SHADE, ROLE_CM.GHOST].includes(cm.id) ? 1 : 5) as number[]).map(n => chances.find(p => p.max >= n)!.value)
                    , desc = [bold(`[${cm.name.toUpperCase()}]`).toString(), inlineCode(`« ${res.map(n => n === 0 ? '💀' : n).join(', ')} »`).toString()];
                    if (res.length > 1 && res.every(n => n !== 0)) desc.push('Sum: ' + inlineCode(res.reduce((sum, n) => sum + n)?.toString()));
                    await fetch.edit({ embeds: [embed.setDescription(desc.join(' '))] });
                    //#endregion
                } catch (err) { Logger.plaintext(err) }
            }, 3_000);
        }; break;
    }
}