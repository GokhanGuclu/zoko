import { ChatInputCommandInteraction, ChannelType, SlashCommandBuilder } from 'discord.js';
import { buildEmbed, formatFooter } from '../lib/ui';

function formatRelative(date: Date | null | undefined): string {
	if (!date) return '—';
	const unix = Math.floor(date.getTime() / 1000);
	return `<t:${unix}:F> • <t:${unix}:R>`;
}

function mapPremiumTier(tier: number): string {
	switch (tier) {
		case 0: return 'Seviye 0';
		case 1: return 'Seviye 1';
		case 2: return 'Seviye 2';
		case 3: return 'Seviye 3';
		default: return `Seviye ${tier}`;
	}
}

function mapVerification(level: number): string {
	switch (level) {
		case 0: return 'Yok';
		case 1: return 'Düşük';
		case 2: return 'Orta';
		case 3: return 'Yüksek (╯°□°）╯︵ ┻━┻)';
		case 4: return 'En Yüksek (┻━┻ ﾐヽ(ಠ益ಠ)ノ彡┻━┻)';
		default: return `${level}`;
	}
}

function mapExplicitFilter(level: number): string {
	switch (level) {
		case 0: return 'Devre Dışı';
		case 1: return 'Üyeler için';
		case 2: return 'Herkes için';
		default: return `${level}`;
	}
}

const data = new SlashCommandBuilder()
	.setName('sunucu-bilgi')
	.setDescription('Bulunduğunuz sunucu hakkında detaylı bilgi gösterir')
	.setDMPermission(false)
	.addBooleanOption((opt) => opt.setName('gizli').setDescription('Yanıt sadece size görünsün (ephemeral)').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
		return;
	}

	const guild = interaction.guild;
	try {
		await guild.fetch(); // banner/vanity gibi alanlar için tazeleme
	} catch {}

	const ephemeral = interaction.options.getBoolean('gizli') ?? false;

	const createdAt = formatRelative(guild.createdAt);
	const premiumTier = mapPremiumTier(guild.premiumTier);
	const boosts = guild.premiumSubscriptionCount ?? 0;
	const ownerMention = guild.ownerId ? `<@${guild.ownerId}>` : '—';
	const locale = guild.preferredLocale || '—';
	const description = guild.description || undefined;
	const vanityUrl = guild.vanityURLCode ? `discord.gg/${guild.vanityURLCode}` : '—';

	// Üyeler
	const totalMembers = guild.memberCount;
	let botCount = 0;
	let humanCount = 0;
	try {
		const cached = guild.members.cache;
		if (cached.size > 0) {
			botCount = cached.filter((m) => m.user.bot).size;
			humanCount = cached.filter((m) => !m.user.bot).size;
		}
	} catch {}

	// Kanallar
	const channels = guild.channels.cache;
	const countText = channels.filter((c) => c.type === ChannelType.GuildText).size;
	const countVoice = channels.filter((c) => c.type === ChannelType.GuildVoice).size;
	const countStage = channels.filter((c) => c.type === ChannelType.GuildStageVoice).size;
	const countForum = channels.filter((c) => c.type === ChannelType.GuildForum).size;
	const countCategory = channels.filter((c) => c.type === ChannelType.GuildCategory).size;

	// Roller / Emojiler / Çıkartmalar
	const rolesCount = Math.max(0, guild.roles.cache.size - 1); // @everyone hariç
	const emojisCount = guild.emojis.cache.size;
	const stickersCount = guild.stickers.cache.size;

	const fields = [
		{ name: 'Sunucu ID', value: guild.id, inline: true },
		{ name: 'Sahip', value: ownerMention, inline: true },
		{ name: 'Oluşturulma', value: createdAt, inline: false },
		{ name: 'Boost Seviyesi', value: `${premiumTier} • Boost: ${boosts}`, inline: true },
		{ name: 'Dil', value: locale, inline: true },
		{ name: 'Vanim URL', value: vanityUrl, inline: true },
		{ name: 'Üyeler', value: `Toplam: ${totalMembers}${humanCount || botCount ? ` • İnsan: ${humanCount} • Bot: ${botCount}` : ''}`, inline: false },
		{ name: 'Kanallar', value: `Metin: ${countText} • Ses: ${countVoice} • Sahne: ${countStage} • Forum: ${countForum} • Kategori: ${countCategory}`, inline: false },
		{ name: 'Roller/Emoji/Sticker', value: `Roller: ${rolesCount} • Emoji: ${emojisCount} • Sticker: ${stickersCount}`, inline: false },
		{ name: 'Doğrulama', value: mapVerification(guild.verificationLevel), inline: true },
		{ name: 'İçerik Filtresi', value: mapExplicitFilter(guild.explicitContentFilter), inline: true },
	];

	const iconURL = guild.iconURL?.({ size: 256 }) || undefined;
	const bannerURL = guild.bannerURL?.({ size: 1024 }) || undefined;

	const embed = buildEmbed({
		title: guild.name,
		description,
		fields,
		thumbnailUrl: iconURL,
		imageUrl: bannerURL,
		footerText: formatFooter(guild.name),
		timestamp: true,
	});

	await interaction.reply({ embeds: [embed], ephemeral, allowedMentions: { parse: [] } });
}

export default { data, execute };


