import { ChannelType, TextChannel, Guild, EmbedBuilder, Message } from 'discord.js';
import { buildEmbed, formatFooter } from './ui';

const LOG_CHANNEL_NAME = 'destek-log';

export async function ensureLogChannel(guild: Guild, parentCategoryId?: string | null): Promise<TextChannel | null> {
	let log = guild.channels.cache.find(
		(c) => c.type === ChannelType.GuildText && c.name === LOG_CHANNEL_NAME
	) as TextChannel | undefined;
	if (log) return log;
	try {
		log = await guild.channels.create({
			name: LOG_CHANNEL_NAME,
			type: ChannelType.GuildText,
			parent: parentCategoryId ?? undefined,
		});
		return log;
	} catch {
		return null;
	}
}

export async function exportChannelTranscript(channel: TextChannel): Promise<string> {
	const parts: string[] = [];
	let lastId: string | undefined;
	for (let i = 0; i < 10; i++) {
		const batch = await channel.messages.fetch({ limit: 100, before: lastId });
		if (batch.size === 0) break;
		const ordered = Array.from(batch.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
		for (const m of ordered) {
			const line = formatMessageLine(m);
			parts.push(line);
			lastId = m.id;
		}
		if (batch.size < 100) break;
	}
	return parts.join('\n');
}

function formatMessageLine(m: Message): string {
	const time = new Date(m.createdTimestamp).toLocaleString();
	const author = `${m.author.tag}`;

	const parts: string[] = [];
	const content = (m.cleanContent ?? '').trim();
	if (content) {
		parts.push(content.replace(/\n/g, ' '));
	}

	if (m.embeds && m.embeds.length > 0) {
		const embedTexts = m.embeds
			.map((e) => {
				const segs: string[] = [];
				if (e.title) segs.push(`Başlık: ${e.title}`);
				if (e.description) segs.push(`Açıklama: ${String(e.description).replace(/\n/g, ' ')}`);
				if (e.fields && e.fields.length) {
					const fieldsText = e.fields
						.map((f) => `${f.name}: ${String(f.value).replace(/\n/g, ' ')}`)
						.join(' | ');
					segs.push(`Alanlar: ${fieldsText}`);
				}
				return segs.join(' | ');
			})
			.filter((t) => !!t);
		if (embedTexts.length) {
			parts.push(`[EMBED] ${embedTexts.join(' || ')}`);
		}
	}

	if (m.attachments && m.attachments.size > 0) {
		const names = Array.from(m.attachments.values())
			.map((a) => a.name)
			.filter((n): n is string => !!n);
		if (names.length) parts.push(`Dosyalar: ${names.join(', ')}`);
	}

	const summary = parts.join(' | ');
	return `[${time}] ${author}: ${summary || '(içerik yok)'}`;
}

export async function postClosureSummary(logChannel: TextChannel, options: {
	guildName: string;
	channelName: string;
	openedByUserId: string;
	flow: string[];
}): Promise<void> {
	const embed = new EmbedBuilder()
		.setTitle('Ticket Kapanış Özeti')
		.setDescription(options.flow.map((s) => `• ${s}`).join('\n'))
		.setColor(0x64748b)
		.setFooter({ text: formatFooter(options.guildName) })
		.setTimestamp(new Date());
	await logChannel.send({ content: `#${options.channelName} (<@${options.openedByUserId}>)`, embeds: [embed] });
}


