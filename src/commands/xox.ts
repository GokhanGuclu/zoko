import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, SlashCommandBuilder, User } from 'discord.js';
import { buildEmbed, formatFooter, getBrandLogoAttachment } from '../lib/ui';
import { getTttContextId, startTtt } from '../lib/tictactoe';
import { renderTtt } from '../lib/tictactoeImage';

const data = new SlashCommandBuilder()
	.setName('xox')
	.setDescription('X-O-X oyunu başlat')
	.setDMPermission(false)
	.addUserOption((opt) => opt.setName('rakip').setDescription('Karşı oynayacağınız kişi (boşsa bot)'));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
		return;
	}
	const opponent: User | null = interaction.options.getUser('rakip');
	const ctx = getTttContextId(interaction.guild.id, interaction.channelId);

	if (!opponent || opponent.bot) {
		// Bot ile oyun
		const state = startTtt(ctx, interaction.user.id, 'bot', true);
		const img = await renderTtt(state, {
			playerX: { name: interaction.user.username, avatarUrl: interaction.user.displayAvatarURL({ size: 128, extension: 'png' }) },
			playerO: { name: 'Bot', avatarUrl: interaction.client.user?.displayAvatarURL({ size: 128, extension: 'png' }) ?? undefined },
		});
		const embed = buildEmbed({
			title: 'ZoKo Games • X-O-X',
			description: `Rakip: Bot\nHamle yapmak için butonlara basın.`,
			imageUrl: `attachment://${img.fileName}`,
			footerText: formatFooter(interaction.guild.name),
			timestamp: true,
			authorName: 'ZoKo Games',
			authorIconUrl: getBrandLogoAttachment()?.url,
			thumbnailUrl: getBrandLogoAttachment()?.url,
		});
		const rows = buildGridRows(state);
		const logo = getBrandLogoAttachment();
		const files = logo ? [{ attachment: img.buffer, name: img.fileName }, logo.file] : [{ attachment: img.buffer, name: img.fileName }];
		await interaction.reply({ embeds: [embed], files, components: rows });
		return;
	}

	// İnsan vs İnsan: davet
	if (opponent.id === interaction.user.id) {
		await interaction.reply({ content: 'Kendinle oynayamazsın. Birini etiketle veya botsuz bırak.', ephemeral: true });
		return;
	}
	const inviteEmbed = buildEmbed({
		title: 'X-O-X Davet',
		description: `<@${opponent.id}>, <@${interaction.user.id}> seninle X-O-X oynamak istiyor. Kabul ediyor musun?`,
		footerText: formatFooter(interaction.guild.name),
		timestamp: true,
	});
	const yesBtn = new ButtonBuilder().setCustomId(`xox:invite:yes:${interaction.user.id}:${opponent.id}`).setLabel('Evet').setEmoji('✅').setStyle(ButtonStyle.Success);
	const noBtn = new ButtonBuilder().setCustomId(`xox:invite:no:${interaction.user.id}:${opponent.id}`).setLabel('Hayır').setEmoji('❌').setStyle(ButtonStyle.Danger);
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(yesBtn, noBtn);
	await interaction.reply({ content: `<@${opponent.id}>`, embeds: [inviteEmbed], components: [row], allowedMentions: { users: [opponent.id] } });
}

export function buildGridRows(state: { board: ("X"|"O"|null)[]; finished: boolean; }): ActionRowBuilder<ButtonBuilder>[] {
	const rows: ActionRowBuilder<ButtonBuilder>[] = [];
	for (let r = 0; r < 3; r++) {
		const row = new ActionRowBuilder<ButtonBuilder>();
		for (let c = 0; c < 3; c++) {
			const i = r * 3 + c;
			const cell = state.board[i];
			let label = '\u200b';
			let style: ButtonStyle = ButtonStyle.Primary; // mavi
			if (cell === 'X') { label = 'X'; style = ButtonStyle.Danger; } // kırmızı
			if (cell === 'O') { label = 'O'; style = ButtonStyle.Success; } // yeşil
			const b = new ButtonBuilder()
				.setCustomId(`xox:move:${i}`)
				.setStyle(style)
				.setLabel(label)
				.setDisabled(state.finished || cell !== null);
			row.addComponents(b);
		}
		rows.push(row);
	}
	return rows;
}

export default { data, execute };


