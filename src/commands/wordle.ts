import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { buildEmbed, formatFooter, getBrandLogoAttachment } from '../lib/ui';
import { renderBoardPng } from '../lib/wordleImage';
import { renderBoard, startWordle, toContextId, setWordleMessageId } from '../lib/wordle';

const data = new SlashCommandBuilder()
	.setName('wordle')
	.setDescription('Türkçe Wordle oyunu başlatır (5-7 harf). Oyundayken yazdığınız her kelime tahmin edilir.')
	.setDMPermission(false)
	.addIntegerOption((opt) => opt.setName('uzunluk').setDescription('Kelime uzunluğu (5-7)').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	const ctx = toContextId(interaction.guild?.id ?? null, interaction.channelId);
	const len = interaction.options.getInteger('uzunluk') ?? 5;
	const state = startWordle(ctx, len);
	const img = await renderBoardPng(state);
	const embed = buildEmbed({
		title: `ZoKo Games • Wordle-TR • ${state.length} harf • ${state.maxAttempts} hak`,
		description: `Bu kanalda yazacağınız her ${state.length} harfli kelime tahmin olarak alınacaktır.`,
		footerText: formatFooter(interaction.guild?.name ?? ''),
		timestamp: true,
		imageUrl: `attachment://${img.fileName}`,
		authorName: 'ZoKo Games',
		authorIconUrl: getBrandLogoAttachment()?.url,
		thumbnailUrl: getBrandLogoAttachment()?.url,
	});
	const logo = getBrandLogoAttachment();
	const files = logo ? [{ attachment: img.buffer, name: img.fileName }, logo.file] : [{ attachment: img.buffer, name: img.fileName }];
	const sent = await interaction.reply({ embeds: [embed], files, fetchReply: true as any });
	try { setWordleMessageId(ctx, (sent as any).id); } catch {}
}

export default { data, execute };


