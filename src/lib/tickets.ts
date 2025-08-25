import {
	CategoryChannel,
	ChannelType,
	Guild,
	GuildMember,
	PermissionOverwrites,
	PermissionsBitField,
	TextChannel,
} from 'discord.js';
import { config as appConfig } from '../config';
import { getPool } from './db';
import { buildEmbed, formatFooter } from './ui';

const TICKET_TOPIC_PREFIX = 'TICKET_USER:';

export function buildTicketChannelName(member: GuildMember): string {
	const base = member.user.username.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
	return `ticket-${base}-${member.id.slice(-4)}`;
}

export async function findExistingTicketChannel(guild: Guild, userId: string, categoryId?: string): Promise<TextChannel | null> {
	const channels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText) as any;
	for (const [, ch] of channels) {
		const text = ch as TextChannel;
		if (categoryId && text.parentId !== categoryId) continue;
		if (text.topic && text.topic.startsWith(TICKET_TOPIC_PREFIX) && text.topic.includes(userId)) {
			return text;
		}
		if (text.name.includes(userId)) {
			return text;
		}
	}
	return null;
}

export async function ensureTicketCategory(guild: Guild): Promise<CategoryChannel | null> {
	// Öncelik: TICKET_CATEGORY_ID verilmişse onu kullan
	if (appConfig.ticketCategoryId) {
		const cat = guild.channels.cache.get(appConfig.ticketCategoryId);
		if (cat && cat.type === ChannelType.GuildCategory) return cat as CategoryChannel;
	}

	// Aksi halde isimle ara; yoksa oluştur
	const wantedName = 'ticket';
	let found = guild.channels.cache.find(
		(c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === wantedName
	) as CategoryChannel | undefined;
	if (found) return found;

	found = await guild.channels.create({
		name: wantedName,
		type: ChannelType.GuildCategory,
	});
	return found;
}

export async function createTicketChannel(member: GuildMember, supportRoleIdFromButton?: string): Promise<TextChannel> {
	const guild = member.guild;
	const existing = await findExistingTicketChannel(guild, member.id, appConfig.ticketCategoryId);
	if (existing) return existing;

	const name = buildTicketChannelName(member);
	const parent = await ensureTicketCategory(guild);

	const overwrites: PermissionOverwrites[] | any = [
		{
			id: guild.roles.everyone.id,
			deny: [
				PermissionsBitField.Flags.ViewChannel,
				PermissionsBitField.Flags.SendMessages,
				PermissionsBitField.Flags.ReadMessageHistory,
			],
		},
		{
			id: member.id,
			allow: [
				PermissionsBitField.Flags.ViewChannel,
				PermissionsBitField.Flags.SendMessages,
				PermissionsBitField.Flags.ReadMessageHistory,
			],
		},
	];

	// İstek gereği: başlangıçta destek rolü kanalı görmesin, bu yüzden eklemiyoruz

	const resolvedSupportRoleId = supportRoleIdFromButton || appConfig.supportRoleId;
	const topicSupport = resolvedSupportRoleId ? `;SUPPORT:${resolvedSupportRoleId}` : ';SUPPORT:';
	const channel = await guild.channels.create({
		name,
		type: ChannelType.GuildText,
		parent: parent?.id,
		topic: `${TICKET_TOPIC_PREFIX}${member.id}${topicSupport}`,
		permissionOverwrites: overwrites,
	});

	return channel;
}

export function extractSupportRoleIdFromTopic(topic?: string | null): string | undefined {
	if (!topic) return undefined;
	const match = topic.match(/SUPPORT:([^;\s]+)/);
	if (match && match[1]) return match[1];
	return undefined;
}

export function extractOpenedUserIdFromTopic(topic?: string | null): string | undefined {
	if (!topic) return undefined;
	const match = topic.match(/TICKET_USER:([^;\s]+)/);
	if (match && match[1]) return match[1];
	return undefined;
}

export async function scheduleChannelClose(
	channel: TextChannel,
	initiatorUserId?: string,
	delayMs: number = 60_000,
	onBeforeDelete?: () => Promise<void>
): Promise<void> {
	const notice = buildEmbed({
		title: 'Kapanış Zamanlandı',
		description: 'Bu kanal 1 dakika içinde kapatılacaktır. Ek bir sorunuz varsa lütfen şimdi belirtin.',
		color: 0xef4444,
		footerText: formatFooter(channel.guild.name),
		timestamp: true,
	});
	const prefix = initiatorUserId ? `<@${initiatorUserId}> ` : '';
	await channel.send({ content: `${prefix}`, embeds: [notice] });
	setTimeout(async () => {
		try {
			if (onBeforeDelete) {
				await onBeforeDelete();
			}
			await channel.delete();
		} catch (e) {
			// Kanal silinemeyebilir (yetki/değişiklik); yoksay
		}
	}, delayMs);
}

// --- Support settings persistence ---
export async function setSupportSettings(guildId: string, panelChannelId: string | null, supportRoleId: string | null): Promise<void> {
    const p = getPool();
    if (!p) return;
    await p.execute(
        `INSERT INTO support_settings (guild_id, panel_channel_id, support_role_id)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE panel_channel_id = VALUES(panel_channel_id), support_role_id = VALUES(support_role_id)`,
        [guildId, panelChannelId, supportRoleId]
    );
}

export async function getSupportSettings(guildId: string): Promise<{ panelChannelId: string | null, supportRoleId: string | null }> {
    const p = getPool();
    if (!p) return { panelChannelId: null, supportRoleId: null };
    const [rows] = (await p.execute('SELECT panel_channel_id, support_role_id FROM support_settings WHERE guild_id = ? LIMIT 1', [guildId])) as unknown as [any[]];
    if (!rows || rows.length === 0) return { panelChannelId: null, supportRoleId: null };
    return { panelChannelId: rows[0].panel_channel_id ?? null, supportRoleId: rows[0].support_role_id ?? null };
}


