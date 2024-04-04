import { ChatInputCommandInteraction, EmbedBuilder, inlineCode } from 'discord.js';

export const message = (i: ChatInputCommandInteraction, text: string = `${inlineCode('...')}`, ephemeral: boolean = false, embed?: EmbedBuilder) => i.reply({
    fetchReply: true, ephemeral, content: text, embeds: !embed ? embed : [embed]
});