// Container for the application commands.
import { bold, ChatInputCommandInteraction, EmbedBuilder, GuildMember, inlineCode, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { env_value, Logger, raise, random } from './tools';
type APPC_RESULT_FUNC = (_: ChatInputCommandInteraction) => Promise<Logger.APPCOMMAND_RESULT>;

const reply = (i: ChatInputCommandInteraction, ephemeral: boolean, text: string = inlineCode('...')) => i.reply({
    fetchReply: true, ephemeral: ephemeral, content: text
});
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

namespace MOD {
    export namespace MUTE {
        export const data = new SlashCommandBuilder().setName('mute')
        .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
        .setDescription('Mute a user for a custom set period.')
        .addUserOption(a => a.setName('user').setDescription('The user.').setRequired(true))
        .addNumberOption(a => a.setName('hours').setDescription('The silence period, with decimal precision.').setRequired(true));

        export const execute: APPC_RESULT_FUNC = async i => {
            const gm = i.options.getMember('user') as GuildMember, hours = i.options.getNumber('hours', true);
            const unmute = hours <= 0;

            await gm.timeout(unmute ? null : hours * 3_600_000);
            return ['complete', await reply(i, false, `${gm} ▸ ${inlineCode(unmute ? 'Unmuted.' : `Muted for ${hours} hours.`)}`)];
        }
    }
}

namespace HEX {
    //#region Prominent namespace roles
    const HEX_CHAIN: [death: string, scarl: string, kismet: string, shade: string] = [env_value('HEX_DEATH')
        , env_value('HEX_SCARL')
        , env_value('HEX_KISMT')
        , env_value('HEX_SHADE')
    ];
    const MARKED = env_value('HEX_MARKED'), MURDIST = env_value('HEX_MURDIST'), AVENGER = env_value('HEX_AVENGER');
    //#endregion

    const sabotager_role = (role: string) => role === HEX_CHAIN[1] || role === HEX_CHAIN[2];

    export namespace PRAY {
        const MAX_P = 0.990, LOSE_SYMBOL = '⚰️';

        const get_d6 = (type: 'normal' | 'avenger' | 'unlucky'): [score: number, bound: number][] => {
            switch (type) {
                case 'unlucky': return [[-9_000, 0.114], [1, 0.335], [2, 0.556], [3, 0.776], [5, 0.930], [6, MAX_P]];
                case 'avenger': return [[1, 0.221], [2, 0.357], [3, 0.494], [4, 0.631], [5, 0.768], [6, MAX_P]];
                default: return [[1, 0.165], [2, 0.330], [3, 0.495], [4, 0.660], [5, 0.825], [6, MAX_P]];
            }
        };
        
        export const data = new SlashCommandBuilder().setName('pray').setDescription('Fight against the curse-mark.');

        export const execute: APPC_RESULT_FUNC = async i => {
            const { displayName: member_name, roles: { cache: member_roles } } = i.member as GuildMember;

            const kismet = (i.guild ?? raise('Null guild')).roles.cache.get(HEX_CHAIN[2]);
            if (!kismet) Logger.to_logs('Kismet role not found.', true);

            const tier = member_roles.find(r => [AVENGER, ...HEX_CHAIN].includes(r.id));
            if (!tier) return ['error', await reply(i, true, 'You\'re neither marked nor a vengeful ghost.')];

            const { id = '', color = 0xFFF, name: tier_definition = inlineCode('...') } = tier;
            const amped = id === HEX_CHAIN[3] || id === AVENGER && (kismet?.members.size ?? 0) > 0;
            const d6 = get_d6(amped ? 'avenger' : sabotager_role(id) ? 'unlucky' : 'normal');

            await i.deferReply();
            await wait(2_000);

            const rolls = random(5).map(v => d6.find(f => f[0] >= v * MAX_P)?.[0] ?? 4);
            if (id === HEX_CHAIN[3] || id === AVENGER) {
                Logger.to_logs(`${tier_definition.toLocaleUpperCase()} ▸ ${member_name} ▸ ${rolls.splice(1).join(' . ')}`, true);
            } // splice to post the latter 4 rolls to the logger.

            const text = inlineCode(`〖 ${rolls.map(r => r <= 0 ? LOSE_SYMBOL : r).join(', ')} 〗`);
            const sum = rolls.length > 1 && !text.includes(LOSE_SYMBOL) ? inlineCode(`〖 ${rolls.reduce((a, b) => a + b, 0)} 〗`) : '';

            const embed = new EmbedBuilder()
            .setColor(color)
            .setDescription(`${bold(tier_definition.toLocaleUpperCase())}\n\n${[text, sum].filter(t => t.length > 0).join(' ▸ ')}`);
            return ['complete', await i.editReply({ embeds: [embed] })];
        }
    }
}

export const DATASET = [HEX.PRAY.data, MOD.MUTE.data].map(d => d.toJSON());