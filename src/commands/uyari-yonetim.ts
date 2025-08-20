import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ChannelSelectMenuBuilder, PermissionsBitField, RoleSelectMenuBuilder, SlashCommandBuilder } from 'discord.js';
import { buildEmbed, formatFooter } from '../lib/ui';
import { getWarnSettings } from '../lib/warn';

const data = new SlashCommandBuilder()
	.setName('uyari-yonetim')
	.setDescription('Uyarı sistemi yönetim panelini gönderir (Yalnızca Yönetici).')
	.setDMPermission(false)
	.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
		return;
	}

	const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId('warnadmin:setLogChannel').setLabel('Log Kanalını Ayarla').setEmoji('📜').setStyle(ButtonStyle.Primary),
	);

	const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId('warnadmin:setRoles').setLabel('Yetkili Rolleri Ayarla').setEmoji('🛡️').setStyle(ButtonStyle.Success),
		new ButtonBuilder().setCustomId('warnadmin:clearAll').setLabel('Tüm Uyarıları Sil').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
	);

	const settings = await getWarnSettings(interaction.guild.id);
	const logChField = settings.logChannelId ? `<#${settings.logChannelId}>` : 'Ayarlı değil';
	const rolesField = settings.allowedRoleIds.length ? settings.allowedRoleIds.map((r) => `<@&${r}>`).join(', ') : 'Ayarlı değil';

	const embed = buildEmbed({
		title: 'Uyarı Yönetim Paneli',
		description: 'Aşağıdaki butonlarla ayarları güncelleyebilirsiniz.',
		fields: [
			{ name: 'System log kanalı', value: logChField, inline: true },
			{ name: 'Uyarı atabilecek roller', value: rolesField, inline: true },
		],
		footerText: formatFooter(interaction.guild.name),
		timestamp: true,
	});

	await interaction.reply({ embeds: [embed], components: [row1, row2], allowedMentions: { parse: [] } });
}

export default { data, execute };


