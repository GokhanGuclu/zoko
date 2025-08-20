import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { buildEmbed, formatFooter } from '../lib/ui';

const data = new SlashCommandBuilder()
	.setName('yardim')
	.setDescription('Komutları kategorilere göre görüntüle');

function buildCategoryButtons(selected: string) {
	const categories = [
		{ id: 'tum', label: 'Tümü', emoji: '📖' },
		{ id: 'genel', label: 'Genel', emoji: '🧭' },
		{ id: 'destek', label: 'Destek', emoji: '🎫' },
		{ id: 'kayit', label: 'Kayıt', emoji: '📝' },
		{ id: 'uyari', label: 'Uyarı', emoji: '⚠️' },
		{ id: 'seviye', label: 'Seviye', emoji: '🏆' },
		{ id: 'oyun', label: 'Oyun', emoji: '🎮' },
		{ id: 'owner', label: 'Sahip', emoji: '👑' },
	];
	const buttons = categories.map((c) => new ButtonBuilder()
		.setCustomId(`help:cat:${c.id}`)
		.setLabel(c.label)
		.setEmoji(c.emoji)
		.setStyle(c.id === selected ? ButtonStyle.Primary : ButtonStyle.Secondary)
	);
	const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(0, 5));
	const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(5));
	return [row1, row2];
}

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	const embed = buildEmbed({
		title: 'Yardım Menüsü',
		description: 'Bir kategori seçmek için alttaki butonları kullan.',
		color: 0x5865f2,
		footerText: formatFooter(interaction.guild?.name || 'ZoKo'),
		timestamp: true,
	});
	const components = buildCategoryButtons('tum');
	await interaction.reply({ embeds: [embed], components, ephemeral: true });
}

export default { data, execute };


