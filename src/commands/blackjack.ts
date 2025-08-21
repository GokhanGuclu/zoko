import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { buildEmbed, formatFooter } from '../lib/ui';
import { getBlackjack, getBlackjackContextId, hitBlackjack, resetBlackjack, standBlackjack, startBlackjack } from '../lib/blackjack';
import { renderBlackjack } from '../lib/blackjackImage';

const data = new SlashCommandBuilder()
	.setName('blackjack')
	.setDescription('Karşı krupiye ile Blackjack oyna');

async function replyWithState(interaction: ChatInputCommandInteraction, ctx: string, ephemeral = false) {
	const state = getBlackjack(ctx)!;
	const img = await renderBlackjack(state);
	const embed = buildEmbed({
		title: '♠️ Blackjack',
		description: state.finished ? (state.result === 'player' ? '🎉 Kazandın!' : state.result === 'dealer' ? '❌ Kaybettin.' : '🤝 Berabere.') : 'Kart çekmek için "Çek"e, durmak için "Dur"a bas.',
		imageUrl: `attachment://${img.fileName}`,
		footerText: formatFooter(interaction.guild?.name || 'ZoKo'),
		timestamp: true,
		color: state.finished ? (state.result === 'player' ? 0x22c55e : state.result === 'dealer' ? 0xef4444 : 0xf59e0b) : 0x111827,
	});
	const hitBtn = new ButtonBuilder().setCustomId('bj:hit').setLabel('Çek').setEmoji('🃏').setStyle(ButtonStyle.Primary).setDisabled(state.finished);
	const standBtn = new ButtonBuilder().setCustomId('bj:stand').setLabel('Dur').setEmoji('✋').setStyle(ButtonStyle.Secondary).setDisabled(state.finished);
	const resetBtn = new ButtonBuilder().setCustomId('bj:reset').setLabel('Yeniden').setEmoji('🔁').setStyle(ButtonStyle.Success).setDisabled(!state.finished);
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(hitBtn, standBtn, resetBtn);
	const files = [{ attachment: img.buffer, name: img.fileName }];
	if (!interaction.replied && !interaction.deferred) {
		await interaction.reply({ embeds: [embed], files, components: [row], ephemeral });
	} else {
		await interaction.followUp({ embeds: [embed], files, components: [row], ephemeral });
	}
}

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	const channelId = interaction.channelId;
	const guildId = interaction.guild?.id ?? null;
	const ctx = getBlackjackContextId(guildId, channelId, interaction.user.id);
	startBlackjack(ctx);
	await replyWithState(interaction, ctx, false);
}

export default { data, execute };


