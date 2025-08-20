import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChatInputCommandInteraction, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { buildEmbed, formatFooter } from '../lib/ui';
import { getLevelSettings, resetAllLevels, setLevelAnnounceChannel, setLevelEnabled } from '../lib/levels';

const data = new SlashCommandBuilder()
	.setName('seviye-yonetim')
	.setDescription('Seviye sistemi yönetim panelini gönderir (Yalnızca Yönetici).')
	.setDMPermission(false)
	.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
		return;
	}

	const settings = await getLevelSettings(interaction.guild.id);
	const chField = settings.announceChannelId ? `<#${settings.announceChannelId}>` : 'Seçilmedi (seviye atlama mesajı konuşulan kanala gider)';
	const status = settings.enabled ? 'Açık' : 'Kapalı';

	const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId('lvladmin:toggle').setLabel(settings.enabled ? 'Seviyeyi Kapat' : 'Seviyeyi Aç').setEmoji(settings.enabled ? '🛑' : '✅').setStyle(settings.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
		new ButtonBuilder().setCustomId('lvladmin:setChannel').setLabel('Seviye Kanalını Ayarla').setEmoji('📢').setStyle(ButtonStyle.Primary),
	);

	const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId('lvladmin:resetAll').setLabel('Tüm Seviyeleri Sıfırla').setEmoji('♻️').setStyle(ButtonStyle.Secondary),
	);

	const embed = buildEmbed({
		title: 'Seviye Yönetim Paneli',
		description: 'Butonlarla seviye sistemini yönetebilirsiniz.',
		fields: [
			{ name: 'Durum', value: status, inline: true },
			{ name: 'Seviye Mesaj Kanalı', value: chField, inline: true },
		],
		footerText: formatFooter(interaction.guild.name),
		timestamp: true,
	});

	await interaction.reply({ embeds: [embed], components: [row1, row2], allowedMentions: { parse: [] } });
}

export default { data, execute };


