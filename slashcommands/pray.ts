import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, SlashCommandBuilder, bold, inlineCode } from 'discord.js';
import { ROLE_CM, CM_SEQUENCE } from '../constants';
import { Logger, arbit } from '../utils';

export const data = new SlashCommandBuilder().setName('pray')
.setDescription('Let\'s resolve some misbeliefs.');

export const execute = async (i: ChatInputCommandInteraction) => {
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