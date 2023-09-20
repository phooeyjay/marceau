import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, inlineCode, roleMention, userMention } from 'discord.js';
import { DM_ROLES } from '../utils/constants.mjs';
import { crandom } from '../utils/common.mjs';
import { basic_log } from '../utils/logger.mjs';

const d6_roll = (/** @type {string} */ role, /** @type {boolean} */ bonus) => {
    const chance_map = role === DM_ROLES.GHOST ? 
    [ // All faces are equal in chance, unless there are Kismet Marked where faces [4], [5], and [6] have a 5% increased chance.
        { max: bonus ? 0.115 : 0.165, value: 1 }, 
        { max: bonus ? 0.230 : 0.330, value: 2 }, 
        { max: bonus ? 0.345 : 0.495, value: 3 }, 
        { max: bonus ? 0.560 : 0.660, value: 4 }, 
        { max: bonus ? 0.775 : 0.825, value: 5 }, 
        { max: 0.990, value: 6 } 
    ] :
    role === DM_ROLES.GREYED ?
    [ // Faces [2], [4], and [6] have a 10% increased chance.
        { max: 0.065, value: 1 },
        { max: 0.330, value: 2 },
        { max: 0.395, value: 3 },
        { max: 0.660, value: 4 },
        { max: 0.725, value: 5 },
        { max: 0.990, value: 6 } 
    ] :
    (role === DM_ROLES.SCARLET || role === DM_ROLES.KISMET) ?
    [ // Face [0] has a 5% decreased chance, while face [5] has a 5% increased chance.
        { max: 0.115, value: 0 },
        { max: 0.280, value: 1 },
        { max: 0.445, value: 2 },
        { max: 0.610, value: 3 },
        { max: 0.775, value: 4 },
        { max: 0.990, value: 5 } 
    ] :
    role === DM_ROLES.CANCER ? 
    [ // Faces [1], [2], and [3] have a 5% increased chance.
        { max: 0.215, value: 1 },
        { max: 0.430, value: 2 },
        { max: 0.645, value: 3 },
        { max: 0.760, value: 4 },
        { max: 0.875, value: 5 },
        { max: 0.990, value: 6 } 
    ] :
    [ // Faces [1] and [2] have a 5% increased chance. Technically, only Death Marked fall into this set.
        { max: 0.215, value: 1 }, 
        { max: 0.430, value: 2 }, 
        { max: 0.570, value: 3 }, 
        { max: 0.710, value: 4 }, 
        { max: 0.850, value: 5 }, 
        { max: 0.990, value: 6 } 
    ];
    return Array.from(crandom(role === DM_ROLES.GHOST || role === DM_ROLES.GREYED ? 1 : 5), n => chance_map.find(p => p.max >= n * 0.990).value);
}

export const data = new SlashCommandBuilder()
.setName('pray')
.setDescription('The confessional is in session.');

export const execute = async (/** @type {ChatInputCommandInteraction} */ interaction) => {
    const tier = interaction.guild.members.resolve(interaction.user).roles.cache.find(r => Object.values(DM_ROLES).includes(r.id));
    if (!tier) return await interaction.reply({ content: `You may do this as a Marked person, or as a ${roleMention(DM_ROLES.GHOST)}`, ephemeral: true });

    const embed = new EmbedBuilder()
    .setAuthor({ name: tier.name.toUpperCase() })
    .setColor(tier.hexColor)
    .setDescription('Consultation in progress. Please be patient.');

    const fetch = await interaction.reply({ content: `${userMention(interaction.user.id)}`, embeds: [embed], fetchReply: true })
    , kismet = await interaction.guild.roles.fetch(DM_ROLES.KISMET) || (_ => { basic_log(new Error('Failed to fetch Kismet Marked role from interaction data.')); return null; })();
    setTimeout(async _ => {
        try {
            const result = d6_roll(tier.id, kismet && kismet.members.size > 0)
            , descs = [ 'Result: ' + inlineCode(`« ${result.map(n => n === 0 ? '💀' : n).join(', ')} »`) ];
            if (result.length > 1 && result.every(n => n !== 0)) descs.push('Sum: ' + inlineCode(result.reduce((sum, n) => sum + n, 0)));
            fetch.edit({ embeds: [embed.setDescription(descs.join(' '))] });
        }
        catch (err) { basic_log(err); }
    }, 3_000);
}