import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, bold, inlineCode } from 'discord.js';
import { Logger, arbit, throwexc } from './utils';
import { ROLE_CM } from './constants';

//#region Private variables
const CM_SEQ = [ROLE_CM.DEATH, ROLE_CM.SCARL, ROLE_CM.KISMT, ROLE_CM.SHADE];
//#endregion


export const register = [
    // 'mark'
    new SlashCommandBuilder().setName('mark')
    .setDescription('Time to incite some jealousy.')
    .addUserOption(o => o.setName('user').setDescription('The victim.').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Would you like to say why?')).toJSON()

    // 'pray'
    , new SlashCommandBuilder().setName('pray')
    .setDescription('Let\'s resolve some misbeliefs.').toJSON()
];

export const execute = async (intent: string, i: ChatInputCommandInteraction) => {
    if (!i.guild) throwexc(`${intent}: Undefined guild.`);
    else switch (intent) {
        case 'mark':
            break;

        case 'pray':
            const cm = i.guild.members.resolve(i.user)?.roles.cache.find((_, k) => CM_SEQ.includes(k) || k === ROLE_CM.GHOST);
            if (!cm) { await i.reply({ ephemeral: true, content: 'Guild roles not permitted.' }); return; }

            const msg = await i.reply({ ephemeral: true, fetchReply: true, content: `⏳` });
            setTimeout(async () => {
                try {
                    const once = [ROLE_CM.GHOST, ROLE_CM.SHADE].includes(cm.id)
                    , carrier = CM_SEQ.slice(1, -1).includes(cm.id)
                    , diehard = cm.id === ROLE_CM.GHOST && (i.guild!.roles.cache.get(ROLE_CM.KISMT)?.members.size || 0) > 0 || cm.id === ROLE_CM.SHADE;

                    const faces = carrier ? [0, 1, 1, 3, 3, 5] : [1, 2, 3, 4, 5, 6];
                    const dist = ((impact: number[]) => {
                        const basechance = 0.990 / impact.reduce((a, b) => a + b);
                        return impact.map(n => n * basechance).map((_, ix, ar) => ar.slice(0, ix + 1).reduce((a, b) => a + b));
                    })(diehard ? [0.75, 1, 1, 1, 1, 1.75] : carrier ? [1.69, 1, 1, 1, 1, 1] : [1, 1, 1, 1, 1, 1]);

                    const end = arbit(once ? 1 : 5).map(n => faces[dist.findIndex(v => v >= n)])
                    , res = { arr: `❰ ${end.map(n => n === 0 ? '💀' : n).join(', ')} ❱`, sum: end.length > 1 && end.every(n => n !== 0) ? `❰ ${end.reduce((a, b) => a + b)} ❱` : undefined };

                    const desc = [bold(cm.name.toUpperCase()), '▸', inlineCode(res.arr), res.sum ? '▸ ' + inlineCode(res.sum) : undefined].join(' ').trim();
                    await msg.channel.send({ content: `${i.user}`, embeds: [new EmbedBuilder().setColor(cm.hexColor).setDescription(desc)] });
                    await i.deleteReply();
                } catch (ex) { Logger.write(ex); }
            }, 3_000);
            break;

        default: throwexc(`${intent}: Unimplemented.`);
    }
}