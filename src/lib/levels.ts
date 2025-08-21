import { getPool } from './db';

export type LevelSettings = {
	enabled: boolean;
	announceChannelId: string | null;
	cooldownSec: number;
	minChars: number;
	minWords: number;
};

const DEFAULT_SETTINGS: LevelSettings = {
	enabled: false,
	announceChannelId: null,
	cooldownSec: 0,
	minChars: 0,
	minWords: 0,
};

// Anti-flood penceresi (10 sn içinde 5 mesaj ve üstü XP almaz)
const RECENT_WINDOW_SEC = 10;
const RECENT_WINDOW_LIMIT = 5; // >=5 ise engelle
const MESSAGE_ACTIVITY: Map<string, number[]> = new Map();

// Bellek içi fallback (DB yoksa)
const MEM_SETTINGS: Map<string, LevelSettings> = new Map();
const MEM_USERS: Map<string, Map<string, { xpTotal: number; level: number; lastXpAt?: number }>> = new Map();

export async function getLevelSettings(guildId: string): Promise<LevelSettings> {
	const pool = getPool();
	if (!pool) {
		const s = MEM_SETTINGS.get(guildId);
		if (s) return { ...s };
		MEM_SETTINGS.set(guildId, { ...DEFAULT_SETTINGS });
		return { ...DEFAULT_SETTINGS };
	}
	const [rows] = (await pool.execute(
		'SELECT enabled, announce_channel_id, cooldown_sec, min_chars, min_words FROM levels_settings WHERE guild_id = ? LIMIT 1',
		[guildId]
	)) as unknown as [any[]];
	if (!rows || rows.length === 0) return { ...DEFAULT_SETTINGS };
	const r = rows[0];
	return {
		enabled: Boolean(r.enabled),
		announceChannelId: r.announce_channel_id || null,
		cooldownSec: Number(r.cooldown_sec ?? DEFAULT_SETTINGS.cooldownSec),
		minChars: Number(r.min_chars ?? DEFAULT_SETTINGS.minChars),
		minWords: Number(r.min_words ?? DEFAULT_SETTINGS.minWords),
	};
}

export async function setLevelEnabled(guildId: string, enabled: boolean): Promise<void> {
	const pool = getPool();
	if (!pool) {
		const s = MEM_SETTINGS.get(guildId) || { ...DEFAULT_SETTINGS };
		s.enabled = enabled;
		MEM_SETTINGS.set(guildId, s);
		return;
	}
	await pool.execute(
		`INSERT INTO levels_settings (guild_id, enabled)
		 VALUES (?, ?) 
		 ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), updated_at = CURRENT_TIMESTAMP`,
		[guildId, enabled ? 1 : 0]
	);
}

export async function setLevelAnnounceChannel(guildId: string, channelId: string | null): Promise<void> {
	const pool = getPool();
	if (!pool) {
		const s = MEM_SETTINGS.get(guildId) || { ...DEFAULT_SETTINGS };
		s.announceChannelId = channelId;
		MEM_SETTINGS.set(guildId, s);
		return;
	}
	await pool.execute(
		`INSERT INTO levels_settings (guild_id, announce_channel_id)
		 VALUES (?, ?) 
		 ON DUPLICATE KEY UPDATE announce_channel_id = VALUES(announce_channel_id), updated_at = CURRENT_TIMESTAMP`,
		[guildId, channelId]
	);
}

export async function resetAllLevels(guildId: string): Promise<number> {
	const pool = getPool();
	if (!pool) {
		const m = MEM_USERS.get(guildId);
		const count = m ? m.size : 0;
		MEM_USERS.set(guildId, new Map());
		return count;
	}
	const [res] = (await pool.execute('DELETE FROM levels_users WHERE guild_id = ?', [guildId])) as unknown as [any];
	return Number(res?.affectedRows ?? 0);
}

// ---- XP & Level hesaplama ----
const XP_A = 5; // geç oyun kıvrımı
const XP_B = 50; // orta seviye eğim
const XP_C = 100; // erken oyun başlangıç (L>=1 için)

// Mesaj başına XP aralığı
const XP_GAIN_MIN = 15;
const XP_GAIN_MAX = 25;

// 1. seviyeye ulaşmak için minimum ~50 mesaj hedefi
const FIRST_LEVEL_MIN_MESSAGES = 50;
const FIRST_LEVEL_XP = XP_GAIN_MAX * FIRST_LEVEL_MIN_MESSAGES; // 25*50 = 1250

export function xpForNextLevel(currentLevel: number): number {
	// L -> L+1 için gereken XP
	if (currentLevel === 0) return FIRST_LEVEL_XP;
	return XP_A * currentLevel * currentLevel + XP_B * currentLevel + XP_C;
}

export function totalXpForLevel(targetLevel: number): number {
	// 0'dan targetLevel'e ulaşmak için toplam XP
	// L==0 -> 0; L>=1 -> FIRST_LEVEL_XP + Sum_{k=1..L-1}(a k^2 + b k + c)
	const L = Math.max(0, targetLevel);
	if (L === 0) return 0;
	const a = XP_A, b = XP_B, c = XP_C;
	const sum_k2_0_to_Lm1 = (L - 1) * L * (2 * L - 1) / 6;
	const sum_k_0_to_Lm1 = (L - 1) * L / 2;
	return Math.floor(a * sum_k2_0_to_Lm1 + b * sum_k_0_to_Lm1 + c * (L - 1) + FIRST_LEVEL_XP);
}

export type AwardResult = {
	awarded: boolean;
	xpGained?: number;
	levelUp?: boolean;
	level?: number;
	xpTotal?: number;
	silent?: boolean;
};

export async function awardMessageXp(
	guildId: string,
	userId: string,
	messageContent: string,
	settings?: LevelSettings,
): Promise<AwardResult> {
	const pool = getPool();

	const s = settings ?? await getLevelSettings(guildId);
	if (!s.enabled) return { awarded: false };

	const content = String(messageContent || '').trim();
	if (!content) return { awarded: false };

	// 10 sn pencere içinde 5+ mesaj atanlara XP verme (anti-flood)
	const nowSec = Math.floor(Date.now() / 1000);
	const activityKey = `${guildId}:${userId}`;
	const existingTimes = MESSAGE_ACTIVITY.get(activityKey) || [];
	const pruned = existingTimes.filter((t) => nowSec - t <= RECENT_WINDOW_SEC);
	pruned.push(nowSec);
	MESSAGE_ACTIVITY.set(activityKey, pruned);
	const isSpam = pruned.length >= RECENT_WINDOW_LIMIT;

	// Kullanıcı mevcut kayıt
	const [rows] = (await pool.execute(
		'SELECT xp_total, level, UNIX_TIMESTAMP(last_xp_at) AS last FROM levels_users WHERE guild_id = ? AND user_id = ? LIMIT 1',
		[guildId, userId]
	)) as unknown as [any[]];
	let xpTotal = rows?.[0]?.xp_total ? Number(rows[0].xp_total) : 0;
	let level = rows?.[0]?.level ? Number(rows[0].level) : 0;
	// Cooldown kaldırıldı

	const xpGain = XP_GAIN_MIN + Math.floor(Math.random() * (XP_GAIN_MAX - XP_GAIN_MIN + 1));
	xpTotal += xpGain;

	// Seviye atlama kontrolü
	let leveledUp = false;
	while (xpTotal >= totalXpForLevel(level + 1)) {
		level += 1;
		leveledUp = true;
	}

	// Upsert
	await pool.execute(
		`INSERT INTO levels_users (guild_id, user_id, xp_total, level, last_xp_at)
		 VALUES (?, ?, ?, ?, FROM_UNIXTIME(?))
		 ON DUPLICATE KEY UPDATE xp_total = VALUES(xp_total), level = VALUES(level), last_xp_at = VALUES(last_xp_at)`,
		[guildId, userId, xpTotal, level, nowSec]
	);

	return { awarded: true, xpGained: xpGain, levelUp: leveledUp, level, xpTotal, silent: isSpam };
}

export type UserLevelRow = { userId: string; xpTotal: number; level: number };

export async function getUserLevel(guildId: string, userId: string): Promise<UserLevelRow> {
	const pool = getPool();
	if (!pool) return { userId, xpTotal: 0, level: 0 };
	const [rows] = (await pool.execute(
		'SELECT xp_total, level FROM levels_users WHERE guild_id = ? AND user_id = ? LIMIT 1',
		[guildId, userId]
	)) as unknown as [any[]];
	if (!rows || rows.length === 0) return { userId, xpTotal: 0, level: 0 };
	return { userId, xpTotal: Number(rows[0].xp_total || 0), level: Number(rows[0].level || 0) };
}

export async function getUserRank(guildId: string, userXpTotal: number): Promise<number | null> {
	const pool = getPool();
	if (!pool) return null;
	const [rows] = (await pool.execute(
		'SELECT COUNT(*) AS higher FROM levels_users WHERE guild_id = ? AND xp_total > ?',
		[guildId, userXpTotal]
	)) as unknown as [any[]];
	const higher = Number(rows?.[0]?.higher ?? 0);
	return higher + 1;
}

export async function getTopUsers(guildId: string, limit: number = 10, offset: number = 0): Promise<UserLevelRow[]> {
	const pool = getPool();
	if (!pool) return [];
	const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
	const safeOffset = Math.max(0, Number(offset) || 0);
	const sql = `SELECT user_id, xp_total, level FROM levels_users WHERE guild_id = ? ORDER BY xp_total DESC LIMIT ${safeOffset}, ${safeLimit}`;
	const [rows] = (await pool.execute(sql, [guildId])) as unknown as [any[]];
	return (rows || []).map((r: any) => ({ userId: String(r.user_id), xpTotal: Number(r.xp_total || 0), level: Number(r.level || 0) }));
}


