import { getPool } from './db';

export type WarnSettings = {
	logChannelId?: string;
	allowedRoleIds: string[];
};

export async function getWarnSettings(guildId: string): Promise<WarnSettings> {
	const pool = getPool();
	if (!pool) return { logChannelId: undefined, allowedRoleIds: [] };
	const result = await pool.execute(
		'SELECT log_channel_id, allowed_role_ids FROM warn_settings WHERE guild_id = ? LIMIT 1',
		[guildId]
	);
	const [rows] = result as unknown as [any[]];
	if (!rows.length) return { logChannelId: undefined, allowedRoleIds: [] };
	const logChannelId = rows[0].log_channel_id ?? undefined;
	const allowedRoleIds = (rows[0].allowed_role_ids as string | null)?.split(',').filter(Boolean) ?? [];
	return { logChannelId, allowedRoleIds };
}

export async function setWarnLogChannel(guildId: string, channelId: string): Promise<void> {
	const pool = getPool();
	if (!pool) return;
	await pool.execute(
		'INSERT INTO warn_settings (guild_id, log_channel_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE log_channel_id = VALUES(log_channel_id)',
		[guildId, channelId]
	);
}

export async function setWarnAllowedRoles(guildId: string, roleIds: string[]): Promise<void> {
	const pool = getPool();
	if (!pool) return;
	await pool.execute(
		'INSERT INTO warn_settings (guild_id, allowed_role_ids) VALUES (?, ?) ON DUPLICATE KEY UPDATE allowed_role_ids = VALUES(allowed_role_ids)',
		[guildId, roleIds.join(',')]
	);
}

export async function clearAllWarns(guildId: string): Promise<number> {
	const pool = getPool();
	if (!pool) return 0;
	const [res] = (await pool.execute('DELETE FROM warns WHERE guild_id = ?', [guildId])) as unknown as [any];
	return (res as any).affectedRows ?? 0;
}

export type WarnRow = {
	id: string;
	guild_id: string;
	user_id: string;
	moderator_id: string;
	reason: string | null;
	image_url?: string | null;
	created_at: string;
};

export async function addWarn(guildId: string, userId: string, moderatorId: string, reason: string | null, imageUrl?: string | null): Promise<string> {
	const pool = getPool();
	if (!pool) throw new Error('DB not configured');
	const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	await pool.execute(
		'INSERT INTO warns (id, guild_id, user_id, moderator_id, reason, image_url) VALUES (?, ?, ?, ?, ?, ?)',
		[id, guildId, userId, moderatorId, reason, imageUrl ?? null]
	);
	return id;
}

export async function listWarns(guildId: string, userId: string, limit: number = 25): Promise<WarnRow[]> {
	const pool = getPool();
	if (!pool) return [];
	const lim = Math.max(1, Math.min(100, Number(limit) || 25));
	const [rows] = (await pool.execute(
		`SELECT id, guild_id, user_id, moderator_id, reason, image_url, created_at
		 FROM warns WHERE guild_id = ? AND user_id = ?
		 ORDER BY created_at DESC LIMIT ${lim}`,[guildId, userId]
	)) as unknown as [any[]];
	return rows as WarnRow[];
}

export async function deleteWarn(guildId: string, warnId: string): Promise<boolean> {
	const pool = getPool();
	if (!pool) return false;
	const [res] = (await pool.execute('DELETE FROM warns WHERE guild_id = ? AND id = ? LIMIT 1', [guildId, warnId])) as unknown as [any];
	return (res as any).affectedRows > 0;
}

export async function getWarnById(guildId: string, warnId: string): Promise<WarnRow | null> {
	const pool = getPool();
	if (!pool) return null;
	const [rows] = (await pool.execute(
		'SELECT id, guild_id, user_id, moderator_id, reason, image_url, created_at FROM warns WHERE guild_id = ? AND id = ? LIMIT 1',
		[guildId, warnId]
	)) as unknown as [any[]];
	if (!rows.length) return null;
	return rows[0] as WarnRow;
}


