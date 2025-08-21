import { APIEmbedField, EmbedBuilder } from 'discord.js';

// Varsayılan vurgulu renk (marka rengi) ve koyu gri arkaplan uyumlu alternatif
const DEFAULT_BRAND_COLOR = 0x8b5cf6; // mor ton
const DEFAULT_FALLBACK_COLOR = 0x2b2d31; // koyu gri ton

type BrandAssets = {
	name: string;
	iconUrl?: string | null;
	url?: string | null;
	bannerUrl?: string | null;
	color?: number | null;
	showThumbnail?: boolean;
	showFooterIcon?: boolean;
};

let BRAND: BrandAssets = {
	name: 'ZoKo',
	iconUrl: null,
	url: null,
	bannerUrl: null,
	color: DEFAULT_BRAND_COLOR,
	showThumbnail: true,
	showFooterIcon: true,
};

export function setBrandAssets(assets: Partial<BrandAssets>): void {
	BRAND = { ...BRAND, ...assets };
}

export type BuildEmbedOptions = {
	title?: string;
	description?: string;
	fields?: APIEmbedField[];
	color?: number;
	footerText?: string;
	timestamp?: boolean;
	url?: string;
	authorName?: string;
	authorIconUrl?: string;
	authorUrl?: string;
	thumbnailUrl?: string;
	imageUrl?: string;
	footerIconUrl?: string;
};

export function buildEmbed(options: BuildEmbedOptions): EmbedBuilder {
	const color = options.color ?? BRAND.color ?? DEFAULT_FALLBACK_COLOR;
	const embed = new EmbedBuilder().setColor(color);

	// Başlık, açıklama, alanlar
	if (options.title) embed.setTitle(options.title);
	if (options.description) embed.setDescription(options.description);
	if (options.fields && options.fields.length) embed.addFields(options.fields);
	if (options.url) embed.setURL(options.url);

	// Yazar (marka) bilgisi
	const authorName = options.authorName ?? BRAND.name;
	const authorIconURL = options.authorIconUrl ?? BRAND.iconUrl ?? undefined;
	const authorUrl = options.authorUrl ?? BRAND.url ?? undefined;
	if (authorName) {
		embed.setAuthor({ name: authorName, iconURL: authorIconURL ?? undefined, url: authorUrl ?? undefined });
	}

	// Küçük görsel (thumbnail) — markayı vurgulamak için
	const thumb = options.thumbnailUrl ?? (BRAND.showThumbnail ? BRAND.iconUrl ?? undefined : undefined);
	if (thumb) embed.setThumbnail(thumb);

	// Büyük görsel (image) — istenirse/banner
	const image = options.imageUrl ?? BRAND.bannerUrl ?? undefined;
	if (image) embed.setImage(image);

	// Alt bilgi ve simgesi
	const footerPieces: string[] = [];
	if (options.footerText) footerPieces.push(options.footerText);
	if (BRAND.name) footerPieces.push(BRAND.name);
	const footerIcon = options.footerIconUrl ?? (BRAND.showFooterIcon ? BRAND.iconUrl ?? undefined : undefined);
	if (footerPieces.length) embed.setFooter({ text: footerPieces.join(' • '), iconURL: footerIcon });

	if (options.timestamp) embed.setTimestamp(new Date());
	return embed;
}

export function formatFooter(guildName: string): string {
	const now = new Date();
	const timeStr = now.toLocaleString();
	// Marka ismi buildEmbed içinde otomatik eklenecek; burada sadece bağlam bilgisi veriyoruz
	return `${guildName} • ${timeStr}`;
}


