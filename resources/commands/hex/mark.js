import { ActionRowBuilder, ChatInputCommandInteraction, Collection, ComponentType, EmbedBuilder, GuildMember, inlineCode, Message, Role, roleMention, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { HEX_AUDIENCE, HEX_CURSEMARKED, HEX_SEQUENCE } from '../../utilities/appsettings.js';
import { $random, $sleep, $throw } from '../../utilities/common.js';
import { $log_command_to_channel } from '../../utilities/logger.js';

const POLL_TIMEOUT_MS = 120_000;

/** @param {GuildMember} member @param {Role[]} afflict */
const resolve_hex = async ({ roles }, afflict) => {
    await roles.remove(HEX_SEQUENCE);
    await $sleep(2_000);
    await roles.add(afflict, 'HEX AFFLICTION');
}

/** @param {GuildMember} member @param {Collection<string, Role>} tierpool @returns {{ NEX: Role | null, EOL: boolean }} */
const tiers = ({ roles }, tierpool) => {
    const current = roles.cache.find(({ id }) => HEX_SEQUENCE.includes(id));
    if (!current) return { NEX: tierpool.get(HEX_SEQUENCE[0]) ?? $throw('Starting mark does not exist.'), EOL: false };

    const ix = HEX_SEQUENCE.indexOf(current.id);
    const next = HEX_SEQUENCE[Math.min(ix == -1 ? 0 : ix + 1, HEX_SEQUENCE.length - 1)];
    return next !== current.id ? {
        NEX: tierpool.get(next) ?? $throw('Subsequent mark does not exist.'),
        EOL: false
    } : { NEX: null, EOL: true };
}

export const data = new SlashCommandBuilder().setName('mark')
.setDescription('Mark a user for their wrongdoings.')
.addUserOption(o => o.setName('user').setDescription('The person to mark.').setRequired(true))
.addStringOption(o => o.setName('reason').setDescription('What did they do wrong this time?'));

/** 
 * @param {ChatInputCommandInteraction} i
 * @returns {import('../../utilities/logger').SLASH_COMMAND_RESULT}
 */
export const execute = async i => {
    /** @type {GuildMember} */ const member = i.options.getMember('user');
    if (member.user.bot) return ['complete', await i.reply({ fetchReply: true, ephemeral: true, content: 'A bot user cannot be marked.' })];

    const guild = i.guild ?? $throw('Invalid guild retrieved for "mark".');
    const state = tiers(member, guild.roles.cache.filter((_, key) => HEX_SEQUENCE.includes(key)));
    if (state.EOL) return ['complete', await i.reply({ fetchReply: true, ephemeral: true, content: `${member} has already reached the ⚠️ END OF THE LINE ⚠️` })];

    //#region Create the embed.
    const embed = new EmbedBuilder()
    .setColor(state.NEX.color)
    .setDescription(`${member} is about to be ${state.NEX}`)
    .setAuthor({ name: 'GUILTY 💀, OR INNOCENT 😇', iconURL: member.displayAvatarURL() });
    const reason = i.options.getString('reason');
    if (reason) embed.addFields({ name: 'Reason', value: reason });
    //#endregion

    //#region Create the select menu.
    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
        .setCustomId(`mark-${Date.now()}`)
        .setPlaceholder('...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
            .setLabel('💀 Guilty!')
            .setValue('Y'),
            new StringSelectMenuOptionBuilder()
            .setLabel('😇 Innocent!')
            .setValue('N')
        )
    );
    //#endregion

    /** @type {Message} */ let message;
    //#region Respond with an ephemeral, then a separate message.
    await i.reply({ ephemeral: true, content: `${inlineCode('...')}` });
    if (!i.channel?.send) {
        await i.deleteReply();
        return ['error', null, new Error('Channel does not support sending of messages.')];
    } else message = await i.channel.send({
        allowedMentions: { parse: ['roles'], repliedUser: false },
        content: `${roleMention(HEX_AUDIENCE)} Poll ends soon!`,
        components: [row],
        embeds: [embed]
    });
    //#endregion

    const votes = new Map();
    message.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: POLL_TIMEOUT_MS })
    .on('collect', async response => {
        votes.set(response.user.id, response.values[0]);
        await response.deferUpdate();
    })
    .on('end', async (data, reason) => {
        try
        {
            if ('messageDelete' == reason) return await message.channel.send(`${member} has been freed from malicious intent.`);

            const box = { SIZE_Y: 0, SIZE_N: 0, BITS: [''] };
            for (const [_, { values }] of data) {
                switch (values[0]) {
                    case 'Y': box.SIZE_Y += 1; break;
                    case 'N': box.SIZE_N += 1; break;
                }
            }

            const unvoted = box.SIZE_Y < 1 && box.SIZE_N < 1;
            if (unvoted || 1 <= (box.SIZE_Y - box.SIZE_N)) {
                const collective = guild.roles.cache.get(HEX_CURSEMARKED) ?? $throw('Cursemarked collective role does not exist.');
                box.BITS.push(`By ${unvoted ? 'default' : 'majority'}, ${member} is now ${state.NEX}`);

                //#region If the mark can affect someone else, then do so.
                const afflicted_users = [member];
                const sabotaging = (id => id == HEX_SEQUENCE[1] || id == HEX_SEQUENCE[2])(state.NEX.id);
                if (sabotaging && $random()[0] >= 0.75) {
                    const cap = HEX_SEQUENCE.slice(0, HEX_SEQUENCE.indexOf(state.NEX.id));
                    const victim = collective.members.filter(m => m.id !== member.id && m.roles.cache.hasAny(...cap)).random();
                    if (victim) {
                        box.BITS.push(`${victim} will also be afflicted due to the nature of the mark.`);
                        afflicted_users.push(victim);
                    }
                }
                for (const m of afflicted_users) await resolve_hex(m, [collective, state.NEX]);
                //#endregion
            } else box.BITS.push(`${member} survives the conundrum.`);

            await message.edit({
                components: [],
                embeds: [embed.setDescription(box.BITS.join(' ').trim() + '\n').setColor(state.NEX.color)]
            });
        } catch (error) {
            $log_command_to_channel(i, ['error', message, error]);
            message.delete();
        }
    });

    await i.deleteReply();
    return ['complete', message];
}