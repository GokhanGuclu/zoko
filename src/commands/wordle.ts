import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { buildEmbed, formatFooter } from '../lib/ui';
import { renderBoardPng } from '../lib/wordleImage';
import { renderBoard, startWordle, toContextId } from '../lib/wordle';

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
		title: `Wordle-TR • ${state.length} harf • ${state.maxAttempts} hak`,
		description: `Bu kanalda yazacağınız her ${state.length} harfli kelime tahmin olarak alınacaktır.`,
		footerText: formatFooter(interaction.guild?.name ?? ''),
		timestamp: true,
		imageUrl: `attachment://${img.fileName}`,
	});
	await interaction.reply({ embeds: [embed], files: [{ attachment: img.buffer, name: img.fileName }] });
}

export default { data, execute };


