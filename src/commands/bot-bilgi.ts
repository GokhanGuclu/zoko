import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getPool } from '../lib/db';
import { renderInfoCardPng } from '../lib/botInfoImage';
import path from 'path';
import fs from 'fs';

function formatBytes(bytes: number): string {
	const units = ['B', 'KB', 'MB', 'GB'];
	let i = 0;
	let val = bytes;
	while (val >= 1024 && i < units.length - 1) {
		val /= 1024;
		i++;
	}
	return `${val.toFixed(val >= 100 ? 0 : val >= 10 ? 1 : 2)} ${units[i]}`;
}

function formatDuration(totalSeconds: number): string {
	const d = Math.floor(totalSeconds / 86400);
	const h = Math.floor((totalSeconds % 86400) / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	const s = Math.floor(totalSeconds % 60);
	const parts: string[] = [];
	if (d) parts.push(`${d}g`);
	if (h) parts.push(`${h}s`);
	if (m) parts.push(`${m}d`);
	parts.push(`${s}sn`);
	return parts.join(' ');
}

function loadPackageMeta(): { name?: string; version?: string; djs?: string } {
	try {
		const pkgPath = path.resolve(__dirname, '../../package.json');
		const raw = fs.readFileSync(pkgPath, 'utf8');
		const json = JSON.parse(raw) as any;
		return {
			name: json.name as string | undefined,
			version: json.version as string | undefined,
			djs: (json.dependencies && json.dependencies['discord.js']) || undefined,
		};
	} catch {
		return {};
	}
}

const data = new SlashCommandBuilder()
	.setName('bot-bilgi')
	.setDescription('Bot hakkında detaylı istatistik ve sürüm bilgilerini gösterir')
	.setDMPermission(true)
	.addBooleanOption((opt) => opt.setName('gizli').setDescription('Yanıt sadece size görünsün (ephemeral)').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	const makeEphemeral = interaction.options.getBoolean('gizli') ?? false;
	const client = interaction.client;
	const now = Date.now();
	const createdTs = interaction.createdTimestamp;
	const latencyMs = now - createdTs;
	const apiPingMs = Math.round(client.ws.ping);

	// Uptime ve zaman damgası
	const uptimeSec = Math.floor(process.uptime());
	const startedAt = new Date(Date.now() - uptimeSec * 1000);
	const startedUnix = Math.floor(startedAt.getTime() / 1000);

	// Hafıza ve CPU
	const mem = process.memoryUsage();
	const rss = formatBytes(mem.rss);
	const heapUsed = formatBytes(mem.heapUsed);
	const heapTotal = formatBytes(mem.heapTotal);

	// Platform / sürümler
	const { name: pkgName, version: pkgVersion, djs } = loadPackageMeta();
	const nodeVersion = process.version;
	const djsVersion = djs || '—';

	// Global sayılar
	const guildCount = client.guilds.cache.size;
	let channelCount = 0;
	let roleCount = 0;
	let emojiCount = 0;
	let userApprox = 0;
	try {
		for (const guild of client.guilds.cache.values()) {
			channelCount += guild.channels.cache.size;
			roleCount += Math.max(0, guild.roles.cache.size - 1);
			emojiCount += guild.emojis.cache.size;
			userApprox += guild.memberCount || 0;
		}
	} catch {}


	// Komut sayıları (global ve bulunduğun sunucuya özel)
	let globalCommandCount: number | null = null;
	let guildCommandCount: number | null = null;
	try {
		const appCommands = await client.application?.commands.fetch().catch(() => null);
		if (appCommands) globalCommandCount = appCommands.size;
	} catch {}
	if (interaction.guild) {
		try {
			const guildCommands = await interaction.guild.commands.fetch().catch(() => null);
			if (guildCommands) guildCommandCount = guildCommands.size;
		} catch {}
	}

	// DB durumu
	const pool = getPool();
	const dbStatus = pool ? 'Etkin (konfigüre)' : 'Devre dışı';

	// Shard bilgisi
	const isSharded = Boolean((client.shard as any)?.count);
	const shardId = isSharded && (client.shard as any).ids && (client.shard as any).ids[0] !== undefined
		? String((client.shard as any).ids[0])
		: null;
	const shardTotal = isSharded ? String((client.shard as any).count) : null;

	const fields = [
		{ name: 'Gecikmeler', value: `Komut: ${latencyMs}ms • API: ${apiPingMs}ms`, inline: false },
		{ name: 'Uptime', value: `${formatDuration(uptimeSec)}\nBaşlangıç: <t:${startedUnix}:F> • <t:${startedUnix}:R>`, inline: false },
		{ name: 'Kaynak Kullanımı', value: `RSS: ${rss} • Heap: ${heapUsed}/${heapTotal}`, inline: false },
		{ name: 'Sürümler', value: `Node: ${nodeVersion}\ndiscord.js: ${djsVersion}\n${pkgName ? `${pkgName}: ${pkgVersion}` : ''}`.trim(), inline: true },
		{ name: 'Dağılım', value: `Sunucu: ${guildCount}\nKanal (yaklaşık): ${channelCount}\nKullanıcı (yaklaşık): ${userApprox}`, inline: true },
		{ name: 'Komutlar', value: guildCommandCount !== null
			? `Sunucu: ${guildCommandCount}${globalCommandCount !== null ? ` • Global: ${globalCommandCount}` : ''}`
			: (globalCommandCount !== null ? `Global: ${globalCommandCount}` : '—'), inline: true },
		{ name: 'DB', value: dbStatus, inline: true },
		{ name: 'Shard', value: isSharded ? `ID: ${shardId} / Toplam: ${shardTotal}` : 'Tek işlem (sharding kapalı)', inline: true },
		{ name: 'Çalışma Ortamı', value: `${process.platform} • ${process.arch}`, inline: true },
	];

	const botUser = client.user;

	const img = await renderInfoCardPng({
		title: botUser ? `${botUser.username} • Bot Bilgisi` : 'Bot Bilgisi',
		subtitle: interaction.guild ? interaction.guild.name : 'Doğrudan Mesaj',
		avatarUrl: botUser?.displayAvatarURL({ size: 128 }) ?? null,
		fields: fields.map((f) => ({ name: f.name, value: String(f.value) })),
	});

	// Görseli embed içinde göster
	await interaction.reply({
		embeds: [{
			title: botUser ? `${botUser.username} • Bot Bilgisi` : 'Bot Bilgisi',
			image: { url: `attachment://${img.fileName}` },
			footer: { text: interaction.guild ? interaction.guild.name : 'Doğrudan Mesaj' },
			timestamp: new Date().toISOString(),
		}],
		files: [{ attachment: img.buffer, name: img.fileName }],
		ephemeral: makeEphemeral,
		allowedMentions: { parse: [] },
	});
}

export default { data, execute };


