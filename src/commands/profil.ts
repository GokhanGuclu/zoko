import { ChatInputCommandInteraction, GuildMember, PermissionFlagsBits, SlashCommandBuilder, User } from 'discord.js';
import { buildEmbed, formatFooter } from '../lib/ui';

const BADGE_LABELS: Record<string, string> = {
	Staff: 'Discord Personeli',
	Partner: 'Sunucu Partneri',
	Hypesquad: 'HypeSquad',
	BugHunterLevel1: 'Bug Hunter I',
	BugHunterLevel2: 'Bug Hunter II',
	HypeSquadOnlineHouse1: 'Bravery',
	HypeSquadOnlineHouse2: 'Brilliance',
	HypeSquadOnlineHouse3: 'Balance',
	PremiumEarlySupporter: 'Erken Destekçi',
	TeamPseudoUser: 'Takım Üyesi',
	VerifiedBot: 'Doğrulanmış Bot',
	VerifiedDeveloper: 'Erken Doğrulanmış Geliştirici',
	PartneredServerOwner: 'Partner Sunucu Sahibi',
	CertifiedModerator: 'Sertifikalı Moderatör',
};

function formatRelative(date: Date | null | undefined): string {
	if (!date) return '—';
	const unix = Math.floor(date.getTime() / 1000);
	return `<t:${unix}:F> • <t:${unix}:R>`;
}

function getKeyPermissions(member: GuildMember | null): string {
	if (!member) return '—';
	const checks: Array<[bigint, string]> = [
		[PermissionFlagsBits.Administrator, 'Yönetici'],
		[PermissionFlagsBits.ManageGuild, 'Sunucuyu Yönet'],
		[PermissionFlagsBits.ManageChannels, 'Kanalları Yönet'],
		[PermissionFlagsBits.ManageRoles, 'Rolleri Yönet'],
		[PermissionFlagsBits.KickMembers, 'Kick'],
		[PermissionFlagsBits.BanMembers, 'Ban'],
		[PermissionFlagsBits.ModerateMembers, 'Zaman Aşımı'],
		[PermissionFlagsBits.ManageMessages, 'Mesajları Yönet'],
		[PermissionFlagsBits.MentionEveryone, 'Everyone Etiketleme'],
	];
	const granted = checks.filter(([flag]) => member.permissions.has(flag)).map(([, label]) => label);
	return granted.length ? granted.join(', ') : '—';
}

async function enrichUser(user: User): Promise<User> {
	try {
		// Banner, bayraklar vb. için zorla fetch
		return await user.fetch(true);
	} catch {
		return user;
	}
}

const data = new SlashCommandBuilder()
	.setName('profil')
	.setDescription('Bir kullanıcının profilini detaylı gösterir')
	.setDMPermission(true)
	.addUserOption((opt) => opt.setName('kisi').setDescription('Profilini görüntülemek istediğiniz kişi').setRequired(false))
	.addBooleanOption((opt) => opt.setName('gizli').setDescription('Yanıt sadece size görünsün (ephemeral)').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	const targetUser = interaction.options.getUser('kisi') ?? interaction.user;
	const makeEphemeral = interaction.options.getBoolean('gizli') ?? false;
	const inGuild = Boolean(interaction.guild);

	const fetchedUser = await enrichUser(targetUser);
	const member: GuildMember | null = inGuild ? await interaction.guild!.members.fetch(targetUser.id).catch(() => null) : null;

	const userTag = `${fetchedUser.username}${fetchedUser.discriminator !== '0' ? `#${fetchedUser.discriminator}` : ''}`;
	const displayName = (member?.nickname || fetchedUser.globalName || fetchedUser.username) ?? fetchedUser.username;
	const isBot = fetchedUser.bot ? 'Evet' : 'Hayır';
	const avatarUrl = fetchedUser.displayAvatarURL({ size: 512 });
	const bannerUrl = fetchedUser.bannerURL?.({ size: 1024 }) || undefined;

	let badges = '—';
	try {
		const flags = await fetchedUser.fetchFlags();
		const arr = flags.toArray();
		badges = arr.length ? arr.map((k) => BADGE_LABELS[k] ?? k).join(', ') : '—';
	} catch {}

	const createdAt = formatRelative(fetchedUser.createdAt);
	const joinedAt = member ? formatRelative(member.joinedAt || null) : '—';
	const boostedAt = member?.premiumSince ? formatRelative(member.premiumSince) : '—';
	const timedOutUntil = (member?.communicationDisabledUntilTimestamp ? formatRelative(new Date(member.communicationDisabledUntilTimestamp)) : '—');

	const roles = member ? member.roles.cache.filter((r) => r.id !== interaction.guild!.id).sort((a, b) => b.position - a.position).toJSON() : [];
	const highestRole = member?.roles.highest && member.roles.highest.id !== interaction.guild!.id ? `<@&${member.roles.highest.id}>` : '—';
	const roleMentions = roles.slice(0, 15).map((r) => `<@&${r.id}>`).join(', ') || '—';
	const rolesOverflow = roles.length > 15 ? ` (+${roles.length - 15} diğer)` : '';

	const color = member?.roles.highest?.color && member.roles.highest.color !== 0 ? member.roles.highest.color : undefined;
	const keyPerms = getKeyPermissions(member);

	const fields = [
		{ name: 'Kullanıcı', value: `${displayName} (${userTag})`, inline: false },
		{ name: 'Kullanıcı ID', value: fetchedUser.id, inline: true },
		{ name: 'Bot mu?', value: isBot, inline: true },
		{ name: 'Rozetler', value: badges, inline: false },
		{ name: 'Hesap Oluşturma', value: createdAt, inline: false },
		{ name: 'Sunucuya Katılma', value: joinedAt, inline: true },
		{ name: 'Boost Başlangıcı', value: boostedAt, inline: false },
		{ name: 'Zaman Aşımı Bitişi', value: timedOutUntil, inline: false },
	];

	if (inGuild) {
		fields.push(
			{ name: `Roller (${roles.length})`, value: `${roleMentions}${rolesOverflow}`, inline: false },
			{ name: 'En Yüksek Rol', value: highestRole, inline: true },
			{ name: 'Önemli Yetkiler', value: keyPerms, inline: false },
		);
	}

	const embed = buildEmbed({
		title: 'Kullanıcı Profili',
		description: inGuild ? `Sunucu: ${interaction.guild!.name}` : undefined,
		fields,
		color,
		footerText: formatFooter(inGuild ? interaction.guild!.name : 'Doğrudan Mesaj'),
		timestamp: true,
		thumbnailUrl: avatarUrl,
		imageUrl: bannerUrl ?? undefined,
	});

	await interaction.reply({ embeds: [embed], ephemeral: makeEphemeral, allowedMentions: { parse: [] } });
}

export default { data, execute };


