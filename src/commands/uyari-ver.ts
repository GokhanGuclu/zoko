import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, TextChannel, EmbedBuilder } from 'discord.js';
import { addWarn, getWarnSettings } from '../lib/warn';
import { buildEmbed, formatFooter } from '../lib/ui';

const data = new SlashCommandBuilder()
	.setName('uyari-ver')
	.setDescription('Bir kullanıcıya uyarı ver ve logla')
	.setDMPermission(false)
	.addUserOption((opt) =>
		opt.setName('kisi').setDescription('Uyarılacak kullanıcı').setRequired(true)
	)
	.addStringOption((opt) =>
		opt.setName('sebep').setDescription('Uyarı nedeni').setRequired(true)
	)
	.addAttachmentOption((opt) =>
		opt.setName('resim').setDescription('Uyarı ile birlikte eklenecek görsel (opsiyonel)').setRequired(false)
	);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
		return;
	}
	// Yetki kontrolü: Yönetici veya izinli roller
	const settings = await getWarnSettings(interaction.guild.id);
	const member = await interaction.guild.members.fetch(interaction.user.id);
	const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
	const hasAllowedRole = settings.allowedRoleIds.length > 0 && settings.allowedRoleIds.some((r) => member.roles.cache.has(r));
	if (!isAdmin && !hasAllowedRole) {
		await interaction.reply({ content: 'Bu komutu kullanma yetkiniz yok.', ephemeral: true });
		return;
	}

	const targetUser = interaction.options.getUser('kisi', true);
	const reasonRaw = interaction.options.getString('sebep', true);
	const reason = reasonRaw.trim();
	if (!reason) {
		await interaction.reply({ content: 'Uyarı nedeni boş olamaz.', ephemeral: true });
		return;
	}
	const attachment = interaction.options.getAttachment('resim') || null;
	const isImage = attachment && (attachment.contentType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(attachment.name || ''));
	const imageUrl = isImage ? attachment!.url : null;
	const warnId = await addWarn(interaction.guild.id, targetUser.id, interaction.user.id, reason, imageUrl);

	// Kullanıcıya bilgi
	await interaction.reply({ content: `Uyarı verildi: ${targetUser} (${warnId})`, allowedMentions: { parse: [] } });

	// Hedef kullanıcıya DM
	try {
		const dmEmbed = buildEmbed({
			title: 'Uyarı Aldınız',
			description: `Bulunduğunuz sunucuda kurallara aykırı bir davranış nedeniyle uyarı aldınız.`,
			fields: [
				{ name: 'Sunucu', value: `${interaction.guild.name}`, inline: true },
				{ name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
				{ name: 'Sebep', value: reason, inline: false },
				{ name: 'Uyarı ID', value: warnId, inline: false },
			],
			footerText: formatFooter(interaction.guild.name),
			timestamp: true,
		});
		if (imageUrl) dmEmbed.setImage(imageUrl);
		await targetUser.send({ embeds: [dmEmbed] });
	} catch {}

	// Log kanalı
	if (settings.logChannelId) {
		const ch = interaction.guild.channels.cache.get(settings.logChannelId) as TextChannel | undefined;
		if (ch) {
			const embed = buildEmbed({
				title: 'Kullanıcı Uyarıldı',
				description: `${targetUser} uyarıldı.`,
				fields: [
					{ name: 'Kullanıcı', value: `${targetUser} (${targetUser.id})`, inline: true },
					{ name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
					{ name: 'Sebep', value: reason, inline: false },
					{ name: 'Warn ID', value: warnId, inline: false },
				],
				footerText: formatFooter(interaction.guild.name),
				timestamp: true,
			});
			try {
				// Discord.js v14: User#displayAvatarURL mevcut
				const avatarUrl = targetUser.displayAvatarURL({ size: 256 });
				(embed as any).setThumbnail?.(avatarUrl);
			} catch {}
			if (imageUrl) (embed as any).setImage?.(imageUrl);
			await ch.send({ embeds: [embed] });
		}
	}
}

export default { data, execute };


