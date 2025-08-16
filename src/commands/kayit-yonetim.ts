import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { buildEmbed, formatFooter } from '../lib/ui';
import { getRegistrationSettings } from '../lib/registration';

const data = new SlashCommandBuilder()
	.setName('kayit-yonetim')
	.setDescription('Kayıt sistemi yönetim panelini gönderir (Yalnızca Yönetici).')
	.setDMPermission(false)
	.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
		return;
	}

	const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId('regadmin:setChannel').setLabel('Kayıt Kanalını Ayarla').setStyle(ButtonStyle.Primary),
		new ButtonBuilder().setCustomId('regadmin:setReviewChannel').setLabel('Kayıt Kontrol Kanalını Ayarla').setStyle(ButtonStyle.Primary),
	);

	const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId('regadmin:setRole').setLabel('Kayıtlı Rolü Ayarla').setStyle(ButtonStyle.Success),
		new ButtonBuilder().setCustomId('regadmin:setNewMemberRole').setLabel('Yeni Üye Rolü Ayarla').setStyle(ButtonStyle.Success),
	);


	const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId('regadmin:modal').setLabel('Modal Yönetimi').setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId('regadmin:reg:info').setLabel('Bilgi').setStyle(ButtonStyle.Secondary),
	);


	const settings = await getRegistrationSettings(interaction.guild.id);
	const channelField = settings?.channelId ? `<#${settings.channelId}>` : 'Ayarlı değil';
	const registeredRoleField = settings?.registeredRoleId ? `<@&${settings.registeredRoleId}>` : 'Ayarlı değil';
	const newMemberRoleField = settings?.newMemberRoleId ? `<@&${settings.newMemberRoleId}>` : 'Ayarlı değil';
    const reviewChannelField = settings?.reviewChannelId ? `<#${settings.reviewChannelId}>` : 'Ayarlı değil';

	const embed = buildEmbed({
		title: 'Kayıt Yönetim Paneli',
		description: 'Aşağıdaki butonlarla ayarları güncelleyebilirsiniz.',
		fields: [
			{ name: 'Kayıt kontrol kanalı', value: reviewChannelField, inline: true },
			{ name: 'Kayıt kanalı', value: channelField, inline: true },
			{ name: '\u200B', value: '\u200B', inline: false },
			{ name: 'Kayıtlı rolü', value: registeredRoleField, inline: true },
			{ name: 'Yeni üye rolü', value: newMemberRoleField, inline: true },
		],
		footerText: formatFooter(interaction.guild.name),
		timestamp: true,
	});

	await interaction.reply({
		embeds: [embed],
		components: [row1, row2, row3],
		allowedMentions: { parse: [] },
	});
}

export default { data, execute };


