import { APIEmbedField, EmbedBuilder } from 'discord.js';

const DEFAULT_COLOR = 0x2b2d31; // koyu gri ton

export function buildEmbed(options: {
	title?: string;
	description?: string;
	fields?: APIEmbedField[];
	color?: number;
	footerText?: string;
	timestamp?: boolean;
}): EmbedBuilder {
	const embed = new EmbedBuilder().setColor(options.color ?? DEFAULT_COLOR);
	if (options.title) embed.setTitle(options.title);
	if (options.description) embed.setDescription(options.description);
	if (options.fields && options.fields.length) embed.addFields(options.fields);
	if (options.footerText) embed.setFooter({ text: options.footerText });
	if (options.timestamp) embed.setTimestamp(new Date());
	return embed;
}

export function formatFooter(guildName: string): string {
	const now = new Date();
	const timeStr = now.toLocaleString();
	return `${guildName} • ${timeStr}`;
}


