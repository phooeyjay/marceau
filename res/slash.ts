import { ChatInputCommandInteraction, Collection, EmbedBuilder, GuildMember, Role, SlashCommandBuilder, TextChannel, bold, inlineCode, roleMention } from 'discord.js';
import { throwexc, datetime, rng, defer, LOG, DBXC } from './utils';
declare global { var bCursePend: boolean; var cCooldownCodex: Collection<string, number>; /*var bHexDisabled: boolean;*/ }

module HEX {
    const HEX_TFRAME_MS = 120_000 // 2 minutes
    , HEX_VOTE_OPTIONS  = ['💀', '😇']
    , HEX_ROLES         = (str => {
        if (!str) return {};
        const [court, marked, ghost, t1, t2, t3, t4] = str.split(',');
        return { COURT: court, MARKD: marked, GHOST: ghost, DEATH: t1, SCARL: t2, KISMT: t3, SHADE: t4 };
    })(process.env.HEX_ROLES) as { COURT: string | '', MARKD: string | '', GHOST: string | '', DEATH: string | '', SCARL: string | '', KISMT: string | '', SHADE: string | '' }
    , HEX_SERIES        = [HEX_ROLES.DEATH, HEX_ROLES.SCARL, HEX_ROLES.KISMT, HEX_ROLES.SHADE];

    const indirect_hex  = (r: string) => HEX_SERIES.slice(1, -1).includes(r);

    export module MARK {
        export const data   = new SlashCommandBuilder().setName('mark')
        .setDescription('Set a curse-mark on a user.')
        .addUserOption(o    => o.setName('user').setDescription('The user.').setRequired(true))
        .addStringOption(o  => o.setName('why').setDescription('A reason, if any, for this action.'));

        const next_state    = (state: Role | undefined, states: Collection<string, Role>) => {
            if (!state) return states.get(HEX_ROLES.DEATH); // initial state
            return state.id === HEX_ROLES.SCARL && (states.get(HEX_ROLES.KISMT)?.members.size || 0) >= 2 ? states.get(HEX_ROLES.SHADE) : states.get(HEX_SERIES[HEX_SERIES.indexOf(state.id) + 1]); // remaining states
        };

        const make_embed    = (state: Role, who: GuildMember, why: string | null) => {
            const _ = new EmbedBuilder()
            .setColor(state.color)
            .setDescription(`${who} is about to be ${state}`)
            .setAuthor({ name: `GUILTY ${HEX_VOTE_OPTIONS[0]} OR INNOCENT ${HEX_VOTE_OPTIONS[1]}`, iconURL: who.displayAvatarURL() });
            return why ? _.addFields({ name: 'Cause of Affliction', value: why }) : _;
        };

        const resolve_hex   = async ({ roles, id }: GuildMember, set: Role[]) => {
            await roles.remove(HEX_SERIES);
            await roles.add(set, 'Afflicted by /mark.');
            global.cCooldownCodex.set(id, Date.now());
        };

        export const exec   = (i: ChatInputCommandInteraction): Promise<LOG.RESULT_BODY> => (async guild => {
            if (global.bCursePend) return ['complete', await i.reply({ fetchReply: true, ephemeral: true, content: 'Only one marking at a time.' }), null];
    
            const victim = guild.members.resolve(i.options.getUser('user', true)) || throwexc('Null user.');
            if (victim.user.bot) return ['complete', await i.reply({ fetchReply: true, content: 'Cursing a bot is not allowed.' }), null];
            else {
                const last = global.cCooldownCodex.get(victim.id);
                if (last && (last + HEX_TFRAME_MS) < Date.now()) return ['complete', await i.reply({ fetchReply: true, ephemeral: true, content: `No marking the same person within ${bold('2 minutes')} of the last result.` }), null];
            }

            const curr = victim.roles.cache.find(({ id }) => HEX_SERIES.includes(id));
            if (curr?.id === HEX_ROLES.SHADE) return ['complete', await i.reply({ fetchReply: true, ephemeral: true, content: `${victim} is on the final cursemark.` }), null];

            const roles = await guild.roles.fetch()
            , next = next_state(curr, roles.filter(({ id }) => HEX_SERIES.includes(id))) || throwexc('Null next tier.');

            const embed = make_embed(next, victim, i.options.getString('reason'));
            
            await defer(i);
            const m = await (i.channel as TextChannel).send({ 
                content: `${roleMention(HEX_ROLES.COURT)} Poll ends ${datetime(HEX_TFRAME_MS, 'T')}`
                , allowedMentions: { parse: ['roles'], repliedUser: false } 
                , embeds: [embed]
            });
            for (const v of HEX_VOTE_OPTIONS) await m.react(v);
    
            //#region Create interaction collector
            const collector = m.createReactionCollector({ filter: ({ emoji }, { bot }) => !bot && HEX_VOTE_OPTIONS.includes(emoji.name || ''), time: HEX_TFRAME_MS });
            collector.on('collect', ({ emoji }, u) => m.reactions.resolve(HEX_VOTE_OPTIONS.filter(v => v !== emoji.name)[0])!.users.remove(u));
            collector.on('end', async (c, r) => {
                try {
                    global.bCursePend = false;
                    if (r === 'messageDelete') return await (m.channel as TextChannel).send(`The imminent curse on ${victim} has been wiped.`);
                    
                    const [unvoted, sway, bits] = ((ysz, nsz) => [
                        ysz <= 0 && nsz <= 0
                        , ysz - nsz
                        , [bold(`${ysz} voted YES, ${nsz} voted NO`) + '\n']
                    ])((c.find(e => e.emoji.name === HEX_VOTE_OPTIONS[0])?.count || 1) - 1, (c.find(e => e.emoji.name === HEX_VOTE_OPTIONS[1])?.count || 1) - 1);
        
                    if (unvoted || sway > 0) {
                        const grouper = roles.get(HEX_ROLES.MARKD) || throwexc('Null grouper.');
        
                        bits.push(`By ${unvoted ? 'default' : 'majority vote'}, ${victim} is now ${next}.`);
                        if (indirect_hex(next.id) && rng() >= 0.625) {
                            // Filter guild members that are not the victim themselves, and not any of the higher tiers.
                            const infect = grouper.members.filter(gm => gm !== victim && !gm.roles.cache.hasAny(HEX_ROLES.SHADE, next.id === HEX_ROLES.KISMT ? HEX_ROLES.KISMT : HEX_ROLES.SHADE)).random()!;
                            bits.push(`${infect} has also been afflicted due to the nature of the curse.`);
                            for (const gm of [victim, infect]) await resolve_hex(gm, [grouper, next]);
                        } else await resolve_hex(victim, [grouper, next]);
                    } else bits.push(`${victim} survives.`);
                    await Promise.all([ m.reactions.removeAll(), m.edit({ content: roleMention(HEX_ROLES.COURT), embeds: [embed.setDescription(bits.join(' ').trim() + '\n')] }) ]);
                } catch (iex) { LOG.interaction(i, ['error', m, iex]); }
            });
            //#endregion
        
            await i.deleteReply();
            global.bCursePend = true;
            return ['complete', m, null];
        })(i.guild || throwexc('Null guild.'));
    }

    export module PRAY {
        export const data   = new SlashCommandBuilder().setName('pray').setDescription('Fight against the curse of the « mark ».');

        export const exec   = (i: ChatInputCommandInteraction): Promise<LOG.RESULT_BODY> => (async (guild, member) => {
            const cm = member.roles.cache.find(({ id }) => HEX_SERIES.includes(id) || id === HEX_ROLES.GHOST);
            if (!cm) return ['error', await i.reply({ fetchReply: true, ephemeral: true, content: 'Action halted; missing role.' }), null];

            const m = await defer(i);
            setTimeout(async () => {
                try {
                    const size = [HEX_ROLES.GHOST, HEX_ROLES.SHADE].includes(cm.id) ? 1 : 5
                    , diehard = cm.id === HEX_ROLES.GHOST && (guild.roles.cache.get(HEX_ROLES.KISMT)?.members.size || 0) > 0 || cm.id === HEX_ROLES.SHADE;
        
                    const faces = indirect_hex(cm.id) ? [0, 1, 1, 3, 3, 5] : [1, 2, 3, 4, 5, 6]
                    , impact = diehard ? [0.75, 1, 1, 1, 1, 1.75] : indirect_hex(cm.id) ? [1.69, 1, 1, 1, 1, 1] : [1, 1, 1, 1, 1, 1];
        
                    const basechance = 0.990 / impact.reduce((a, b) => a + b)
                    , distribution = impact.map(n => n * basechance).map((_, ix, ar) => ar.slice(0, ix + 1).reduce((a, b) => a + b));

                    const [display, sum] = (array => [
                        `❰ ${array.map(n => (n === 0 ? '💀' : n) ?? 6).join(', ')} ❱`
                        , array.length > 1 && array.every(n => n !== 0) ? `❰ ${array.reduce((x, y) => x + y)} ❱` : null
                    ])(rng(size).map(n => faces[distribution.findIndex(v => v >= n)]));
        
                    const desc = `${bold(cm.name.toUpperCase())} ▸ ${inlineCode(display)} ${sum ? '▸ ' + inlineCode(sum) : null}`.trim();
                    const out = await (m.channel as TextChannel || throwexc('Unresolvable TextChannel')).send({ 
                        content: `${i.user}`, 
                        embeds: [new EmbedBuilder().setColor(cm.hexColor).setDescription(desc)] 
                    });
                    await m.delete();
                    LOG.interaction(i, ['complete', out, null]);
                } catch (iex) { LOG.interaction(i, ['error', m, iex]); }
            }, 3_000);
            return ['ongoing', null, null];
        })(i.guild || throwexc('Null guild.'), i.member as GuildMember || throwexc('Null user.'));
    }

    // export module TRIAL {
    //     export const data   = new SlashCommandBuilder().setName('court').setDescription('Managerial procedures for the courtroom.')
    //     .addSubcommand(c => c.setName('begin').setDescription('Initiate a session.'))
    //     .addSubcommand(c => c.setName('end').setDescription('End an active session.'));

    //     export const exec   = (i: ChatInputCommandInteraction): Promise<LOG.RESULT_BODY> => (async (guild, sub) => {
    //         if (sub === 'begin') {
    //             const hexed = guild.roles.cache.get(HEX_ROLES.MARKD)?.members.map(m => m) || throwexc('Null guild role CURSEMARKED.');
    //             if (hexed.length < 1) return ['complete', await i.reply({ fetchReply: true, ephemeral: true, content: 'A trial may not start when there are no Marked.' }), null];

    //             if (!global.bHexDisabled || DBXC.find_active_trial() !== null) {
    //                 global.bHexDisabled = true;
    //                 return ['complete', await i.reply({ fetchReply: true, ephemeral: true, content: 'A trial is already in session.' }), null];
    //             }

    //             DBXC.begin_trial({ started: datetime() }, o => {
    //                 o.active    = true;
    //                 o.ghost     = rng(5);
    //                 hexed.forEach(({ id }) => o.hexed[id] = 0);
    //             });
    //             return ['complete', await i.reply({ fetchReply: true, content: `${roleMention(HEX_ROLES.COURT)} ${roleMention(HEX_ROLES.MARKD)} The time has come to pray.` }), null];
    //         }
    //         // else if (sub === 'end') {

    //         // }
    //         else return ['error', await i.reply({ fetchReply: true, ephemeral: true, content: `The task '${sub}' is not assigned.` }), null];
    //     })(i.guild || throwexc('Null guild.'), i.options.getSubcommand(true) as 'begin' | 'end');
    // }
}

module MOD {
    export module MUTE {
        export const data   = new SlashCommandBuilder().setName('mute')
        .setDescription('Mute a user for a custom set period.')
        .addUserOption(o    => o.setName('user').setDescription('The user.').setRequired(true))
        .addNumberOption(o  => o.setName('hours').setDescription('The silence period, with decimal precision.').setRequired(true));

        export const exec   = (i: ChatInputCommandInteraction): Promise<LOG.RESULT_BODY> => (async guild => {
            const gm    = guild.members.resolve(i.options.getUser('user', true)) || throwexc('Null GuildMember.')
            , hours     = i.options.getNumber('hours', true)
            , unmute    = hours <= 0;
            await gm.timeout(unmute ? null : hours * 3_600_000);
            return ['complete', await i.reply({ fetchReply: true, ephemeral: unmute, content: [`${gm}`, '▸', unmute ? 'Unmuted.' : `Muted for ${bold(hours + ' hours.')}`].join(' ') }), null];
        })(i.guild || throwexc('Null guild.'));
    }

    export module MIGRATE_ROLE {
        export const data   = new SlashCommandBuilder().setName('migrate-role')
        .setDescription('Moves users of a specified role to another role.')
        .addRoleOption(o    => o.setName('src').setDescription('The role to migrate from.').setRequired(true))
        .addRoleOption(o    => o.setName('end').setDescription('The role to migrate to.').setRequired(true))
        .addUserOption(o    => o.setName('user').setDescription('A specific user to migrate.'));

        export const exec   = (i: ChatInputCommandInteraction): Promise<LOG.RESULT_BODY> => (async member => {
            const src = i.options.getRole('src', true) as Role
            , end = i.options.getRole('end', true) as Role;

            const array = member ? [member as GuildMember] : src.members.map(gm => gm);
            for (const gm of array) {
                await gm.roles.remove(src);
                await gm.roles.add(end, 'Migrated role.');
            }
            return ['complete', await i.reply({ fetchReply: true, ephemeral: true, content: `Migrated ${array.length} member(s) from ${src} to ${end}` }), null];
        })(i.options.getMember('user'));
    }

    export module MODIFY_GLOBALS {
        export const data   = new SlashCommandBuilder().setName('modify-globals')
        .setDescription('Directly update global variables from the textbox.')
        .addStringOption(o  => o.setName('name').setDescription('The name of the global variable.').setRequired(true))
        .addStringOption(o  => o.setName('value').setDescription('The value to assign.').setRequired(true));

        export const exec   = (i: ChatInputCommandInteraction): Promise<LOG.RESULT_BODY> => (async (name, val) => {
            if (name in global) {
                switch (typeof global[name]) {
                    case 'boolean': 
                        global[name] = Boolean(val); 
                        break;
                    case 'number':
                        global[name] = Number(val);
                        break;
                    case 'string':
                        global[name] = val;
                        break;
                    default: return ['error', await i.reply({ fetchReply: true, ephemeral: true, content: 'Global variable type is not permitted to be modified.' }), null];
                }
                return ['complete', await i.reply({ fetchReply: true, ephemeral: true, content: `Assigned value '${val}' to global variable '${name}'.` }), null];
            }
            else return ['error', await i.reply({ fetchReply: true, ephemeral: true, content: `Global variable ${name} does not exist.` }), null];
        })(i.options.getString('name', true), i.options.getString('value', true))
    }
}

module GGZ {
    export module STATUS {
        export const data   = new SlashCommandBuilder().setName('status')
        .setDescription('A status window, all about you.');

        export const exec   = (i: ChatInputCommandInteraction): Promise<LOG.RESULT_BODY> => (async ({ id, displayName, displayAvatarURL, roles, joinedAt }) => {
            //const record = await DB.get_user(id);
            //if (!record) return ['complete', await i.reply({ fetchReply: true, ephemeral: true, content: 'No records of you can be found.' }), null];

            const embed = new EmbedBuilder()
            .setImage(displayAvatarURL())
            .setFooter({ text: `Member since ${joinedAt?.toLocaleString() || 'DATE_ERROR'}` })
            .addFields({ name: 'Current Experience', value: `${inlineCode(Array(16).fill('◻').join(''))} ${bold('Level 0')}` });
            (r => embed.setColor(r.color).setAuthor({ name: `${displayName} 【 ${r.name.toUpperCase()} 】` }))(roles.highest);

            return ['complete', await i.reply({ fetchReply: true, ephemeral: true, embeds: [embed] }), null];
        })(i.member as GuildMember || throwexc('Null GuildMember.'));
    }
}

//#region EXPORT DECLARATIONS
export const DATASET    = [
    HEX.MARK.data.toJSON()
    , HEX.PRAY.data.toJSON()
    , MOD.MUTE.data.toJSON()
    , MOD.MIGRATE_ROLE.data.toJSON()
    , MOD.MODIFY_GLOBALS.data.toJSON()
    , GGZ.STATUS.data.toJSON()
];
export const EXECUTE    = (i: ChatInputCommandInteraction): Promise<LOG.RESULT_BODY> => (async name =>
    name === 'mark'             ? await HEX.MARK.exec(i)
    : name === 'pray'           ? await HEX.PRAY.exec(i)
    : name === 'mute'           ? await MOD.MUTE.exec(i)
    : name === 'migrate-role'   ? await MOD.MIGRATE_ROLE.exec(i)
    : name === 'modify-globals' ? await MOD.MODIFY_GLOBALS.exec(i)
    : name === 'status'         ? await GGZ.STATUS.exec(i)
    : throwexc('Command not implemented.'))(i.commandName);
//#endregion