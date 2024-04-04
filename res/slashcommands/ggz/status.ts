// module GGZ {
//     export module STATUS {
//         export const data   = new SlashCommandBuilder().setName('status')
//         .setDescription('A status window, all about you.');

//         export const exec   = (i: ChatInputCommandInteraction): Promise<LOG.RESULT_BODY> => (async gm => {
//             //const record = await DB.get_user(id);
//             //if (!record) return ['complete', await i.reply({ fetchReply: true, ephemeral: true, content: 'No records of you can be found.' }), null];

//             const embed = new EmbedBuilder()
//             .setThumbnail(gm.displayAvatarURL())
//             .setFooter({ text: `Member since ${gm.joinedAt?.toLocaleString() || 'DATE_ERROR'}` })
//             .addFields({ name: 'Current Experience', value: `${inlineCode(Array(16).fill('◻').join(''))} ${bold('Level 0')}` });
//             (r => embed.setColor(r.color).setAuthor({ name: `${gm.displayName} 【 ${r.name.toUpperCase()} 】` }))(gm.roles.highest);

//             return ['complete', await i.reply({ fetchReply: true, ephemeral: true, embeds: [embed] }), null];
//         })(i.member as GuildMember || throwexc('Null GuildMember.'));
//     }
// }