import {
	ActionRowBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	ComponentType,
	EmbedBuilder,
	TextChannel,
} from 'discord.js';
import { getPool } from './db';
import { buildEmbed, formatFooter } from './ui';

export type FaqEntry = {
	id: string;
	title: string;
	question: string;
	answer: string;
};

type FaqRow = {
	id: string;
	title: string;
	question: string;
	answer: string;
};

const guildIdToFaqs = new Map<string, FaqEntry[]>();

export async function addFaq(guildId: string, entry: Omit<FaqEntry, 'id'>): Promise<FaqEntry> {
	const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	const full: FaqEntry = { id, ...entry };
	const pool = getPool();
	if (pool) {
		await pool.execute(
			'INSERT INTO faqs (id, guild_id, title, question, answer) VALUES (?, ?, ?, ?, ?)',
			[id, guildId, entry.title, entry.question, entry.answer]
		);
	}
	const list = guildIdToFaqs.get(guildId) ?? [];
	list.push(full);
	guildIdToFaqs.set(guildId, list);
	return full;
}

export async function listFaqs(guildId: string): Promise<FaqEntry[]> {
	const pool = getPool();
	if (pool) {
		const result = await pool.execute(
			'SELECT id, title, question, answer FROM faqs WHERE guild_id = ? ORDER BY created_at ASC',
			[guildId]
		);
		const [rows] = result as unknown as [FaqRow[]];
		const list = rows.map((r: FaqRow) => ({ id: r.id, title: r.title, question: r.question, answer: r.answer }));
		guildIdToFaqs.set(guildId, list);
		return list;
	}
	return guildIdToFaqs.get(guildId) ?? [];
}

export async function findFaq(guildId: string, faqId: string): Promise<FaqEntry | undefined> {
	const cached = (guildIdToFaqs.get(guildId) ?? []).find((f) => f.id === faqId);
	if (cached) return cached;
	const pool = getPool();
	if (!pool) return undefined;
	const result = await pool.execute(
		'SELECT id, title, question, answer FROM faqs WHERE guild_id = ? AND id = ? LIMIT 1',
		[guildId, faqId]
	);
	const [rows] = result as unknown as [FaqRow[]];
	if (!rows.length) return undefined;
	return { id: rows[0].id, title: rows[0].title, question: rows[0].question, answer: rows[0].answer };
}

export async function updateFaq(
	guildId: string,
	faqId: string,
	updates: Partial<Pick<FaqEntry, 'title' | 'question' | 'answer'>>
): Promise<FaqEntry | undefined> {
	const list = guildIdToFaqs.get(guildId) ?? [];
	const idx = list.findIndex((f) => f.id === faqId);
	if (idx === -1) return undefined;
	const updated: FaqEntry = { ...list[idx], ...updates };
	const pool = getPool();
	if (pool) {
		const fields: string[] = [];
		const values: any[] = [];
		if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
		if (updates.question !== undefined) { fields.push('question = ?'); values.push(updates.question); }
		if (updates.answer !== undefined) { fields.push('answer = ?'); values.push(updates.answer); }
		if (fields.length) {
			values.push(guildId, faqId);
			await pool.execute(`UPDATE faqs SET ${fields.join(', ')} WHERE guild_id = ? AND id = ?`, values);
		}
	}
	list[idx] = updated;
	guildIdToFaqs.set(guildId, list);
	return updated;
}

export async function deleteFaq(guildId: string, faqId: string): Promise<boolean> {
	const list = guildIdToFaqs.get(guildId) ?? [];
	const next = list.filter((f) => f.id !== faqId);
	if (next.length === list.length) return false;
	const pool = getPool();
	if (pool) {
		await pool.execute('DELETE FROM faqs WHERE guild_id = ? AND id = ?', [guildId, faqId]);
	}
	guildIdToFaqs.set(guildId, next);
	return true;
}

export function buildFaqSelectSync(guildId: string): ActionRowBuilder<StringSelectMenuBuilder>[] {
	const faqs = guildIdToFaqs.get(guildId) ?? [];
	if (faqs.length === 0) return [];
	const options = faqs.slice(0, 25).map((f) =>
		new StringSelectMenuOptionBuilder().setLabel(f.title.slice(0, 100)).setValue(f.id)
	);
	const menu = new StringSelectMenuBuilder()
		.setCustomId('ticket:faq:select')
		.setPlaceholder('Bir konu seçin')
		.addOptions(options);
	return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)];
}

export async function sendFaqMenu(channel: TextChannel, guildId: string): Promise<void> {
	const faqs = await listFaqs(guildId);
	if (faqs.length === 0) {
		await channel.send({ content: 'Hazır soru/cevap bulunmuyor. Yetkililer `/destek-soru-olustur` ile ekleyebilir.' });
		return;
	}

	const embed = buildEmbed({
		title: 'Sık Sorulanlar',
		description: faqs.map((f, i) => `• ${f.title}`).join('\n'),
		color: 0xf59e0b,
		footerText: formatFooter(channel.guild.name),
		timestamp: true,
	});
	const components = buildFaqSelectSync(guildId);
	await channel.send({ embeds: [embed], components });
}


