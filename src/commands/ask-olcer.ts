import { ChatInputCommandInteraction, SlashCommandBuilder, User } from 'discord.js';
import { buildEmbed, formatFooter } from '../lib/ui';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';

// Varsayılan font yüklemeyi dener (opsiyonel). Hata olursa yoksay.
try {
	GlobalFonts.registerFromPath(require('path').join(process.cwd(), 'assets', 'fonts', 'Inter-SemiBold.ttf'), 'Inter');
} catch {}

function seededPercent(a: string, b: string): number {
	// İki ID'yi deterministik bir yüzdeye çevir (0..100)
	const s = a < b ? `${a}:${b}` : `${b}:${a}`;
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	const x = (h >>> 0) % 101;
	return x;
}

function getBarColorByPercent(p: number): string {
	if (p >= 80) return '#22c55e'; // yeşil
	if (p >= 60) return '#84cc16';
	if (p >= 40) return '#f59e0b';
	if (p >= 20) return '#f97316';
	return '#ef4444'; // kırmızı
}

function getCenterEmoji(p: number): string {
	if (p >= 85) return '🔥';
	if (p >= 70) return '💖';
	if (p >= 50) return '🙂';
	if (p >= 30) return '😕';
	return '💔';
}

function getTwemojiUrl(emoji: string): string {
	const overrides: Record<string, string> = {
		'❤': '2764-fe0f',
		'🔥': '1f525',
		'💖': '1f496',
		'🙂': '1f642',
		'😕': '1f615',
		'💔': '1f494',
	};
	let code = overrides[emoji];
	if (!code) {
		const seq = Array.from(emoji)
			.map((c) => c.codePointAt(0)!.toString(16))
			.join('-')
			.toLowerCase();
		code = seq;
	}
	return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${code}.png`;
}


async function drawLoveCard(userA: User, userB: User, percent: number): Promise<Buffer> {
	// Daha geniş, modern görünüm
	const width = 1280;
	const height = 512;
	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext('2d');

	// Arkaplan gradient + radial parıltı
	const bgGrad = ctx.createLinearGradient(0, 0, width, height);
	bgGrad.addColorStop(0, '#0b1020');
	bgGrad.addColorStop(1, '#6d28d9');
	ctx.fillStyle = bgGrad;
	ctx.fillRect(0, 0, width, height);

	const radial = ctx.createRadialGradient(width / 2, height / 2, 10, width / 2, height / 2, Math.max(width, height) / 1.2);
	radial.addColorStop(0, 'rgba(255,255,255,0.10)');
	radial.addColorStop(1, 'rgba(255,255,255,0.00)');
	ctx.fillStyle = radial;
	ctx.fillRect(0, 0, width, height);

	// Kart gövdesi
	const cardMargin = 24;
	const cardRadius = 24;
	const cardX = cardMargin;
	const cardY = cardMargin;
	const cardW = width - cardMargin * 2;
	const cardH = height - cardMargin * 2;

	ctx.save();
	ctx.shadowColor = 'rgba(0,0,0,0.45)';
	ctx.shadowBlur = 24;
	roundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
	ctx.fillStyle = 'rgba(17, 24, 39, 0.85)';
	ctx.fill();
	ctx.restore();

	// Avatarlar (daha büyük ve geniş yerleşim)
	const r = 110;
	const aX = cardX + 260;
	const aY = cardY + cardH / 2 - 20;
	const bX = cardX + cardW - 260;
	const bY = aY;

	const aUrl = userA.displayAvatarURL({ size: 256, extension: 'png' });
	const bUrl = userB.displayAvatarURL({ size: 256, extension: 'png' });
	const [aImg, bImg] = await Promise.all([loadImage(aUrl), loadImage(bUrl)]);

	clipCircleImage(ctx, aImg, aX, aY, r);
	clipCircleImage(ctx, bImg, bX, bY, r);

	// Avatar dışına halka parıltı
	drawAvatarRing(ctx, aX, aY, r + 8);
	drawAvatarRing(ctx, bX, bY, r + 8);

	// Orta kalp alanı
	const heartCX = width / 2;
	const heartCY = height / 2 - 24;
	// Ölçüm halkası (gauge)
	drawGauge(ctx, heartCX, heartCY, 80, percent);
	// Yüzdeye göre emoji rozet (twemoji görseliyle)
	ctx.beginPath();
	ctx.arc(heartCX, heartCY, 46, 0, Math.PI * 2);
	ctx.fillStyle = '#0ea5e9';
	ctx.fill();
	try {
		const emoji = getCenterEmoji(percent);
		const url = getTwemojiUrl(emoji);
		const img = await loadImage(url);
		const size = 44;
		ctx.drawImage(img, heartCX - size / 2, heartCY - size / 2, size, size);
	} catch {
		ctx.font = 'bold 44px Inter, system-ui, -apple-system, Segoe UI, Arial';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = '#ffffff';
		ctx.fillText('❤', heartCX, heartCY + 4);
	}

	// İsimler
	ctx.font = '600 30px Inter, system-ui, -apple-system, Segoe UI, Arial';
	ctx.fillStyle = '#e5e7eb';
	ctx.textAlign = 'center';
	ctx.fillText(getDisplay(userA), aX, cardY + 54);
	ctx.fillText(getDisplay(userB), bX, cardY + 54);

	// Yüzde ve bar
	const pct = Math.max(0, Math.min(100, Math.round(percent)));
	const barW = cardW - 360;
	const barH = 30;
	const barX = (width - barW) / 2;
	const barY = heartCY + 150; // daha aşağı alındı

	// Bar arkaplanı
	roundedRect(ctx, barX, barY, barW, barH, 13);
	ctx.fillStyle = 'rgba(255,255,255,0.12)';
	ctx.fill();

	// Bar dolum
	const fillW = Math.round((pct / 100) * barW);
	if (fillW > 0) {
		roundedRect(ctx, barX, barY, fillW, barH, 13);
		const fillGrad = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
		const c = getBarColorByPercent(pct);
		fillGrad.addColorStop(0, c);
		fillGrad.addColorStop(1, '#22d3ee');
		ctx.fillStyle = fillGrad;
		ctx.fill();
	}

	// Yüzde metni
	ctx.font = '700 34px Inter, system-ui, -apple-system, Segoe UI, Arial';
	ctx.fillStyle = '#ffffff';
	ctx.textAlign = 'center';
	ctx.fillText(`Uyumluluk: ${pct}%`, heartCX, barY + barH + 38);

	// Üst orta marka etiketi (isimlerden uzak)
	ctx.font = '700 22px Inter, system-ui, -apple-system, Segoe UI, Arial';
	ctx.textAlign = 'center';
	ctx.fillStyle = 'rgba(255,255,255,0.8)';
	ctx.fillText('ZoKo Love Meter', width / 2, cardY + 36);

	// Kalp parçacıkları ve noise (twemoji ile)
	try {
		const p1 = await loadImage(getTwemojiUrl('💖'));
		const p2 = await loadImage(getTwemojiUrl('❤'));
		drawHeartParticles(ctx, width, height, [p1, p2]);
	} catch {
		drawHeartParticles(ctx, width, height, null);
	}
	drawSoftNoise(ctx, width, height);

	return canvas.toBuffer('image/png');
}

function getDisplay(u: User): string {
	const tag = `${u.username}${u.discriminator !== '0' ? `#${u.discriminator}` : ''}`;
	return u.globalName ? `${u.globalName} (${tag})` : tag;
}

function roundedRect(ctx: any, x: number, y: number, w: number, h: number, r: number): void {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

function clipCircleImage(ctx: any, img: any, cx: number, cy: number, r: number): void {
	ctx.save();
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.closePath();
	ctx.clip();
	ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
	ctx.restore();

	// Kenar vurgusu
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.strokeStyle = 'rgba(255,255,255,0.25)';
	ctx.lineWidth = 4;
	ctx.stroke();
}

function drawAvatarRing(ctx: any, cx: number, cy: number, radius: number): void {
	ctx.save();
	ctx.beginPath();
	ctx.arc(cx, cy, radius, 0, Math.PI * 2);
	const grad = ctx.createRadialGradient(cx, cy, radius - 10, cx, cy, radius + 10);
	grad.addColorStop(0, 'rgba(147, 51, 234, 0.35)');
	grad.addColorStop(1, 'rgba(14, 165, 233, 0.10)');
	ctx.strokeStyle = grad;
	ctx.lineWidth = 8;
	ctx.stroke();
	ctx.restore();
}

function drawGauge(ctx: any, cx: number, cy: number, radius: number, percent: number): void {
	const pct = Math.max(0, Math.min(100, percent));
	const start = -Math.PI * 0.75; // 225°
	const endMax = Math.PI * 0.75; // 135°
	const end = start + (endMax - start) * (pct / 100);

	// Arkaplan kemer
	ctx.save();
	ctx.beginPath();
	ctx.arc(cx, cy, radius, start, endMax);
	ctx.strokeStyle = 'rgba(255,255,255,0.15)';
	ctx.lineWidth = 16;
	ctx.lineCap = 'round';
	ctx.stroke();

	// Dolum kemeri
	ctx.beginPath();
	ctx.arc(cx, cy, radius, start, end);
	const grad = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
	const c = getBarColorByPercent(pct);
	grad.addColorStop(0, c);
	grad.addColorStop(1, '#22d3ee');
	ctx.strokeStyle = grad;
	ctx.lineWidth = 16;
	ctx.lineCap = 'round';
	ctx.stroke();
	ctx.restore();
}

function drawHeartParticles(ctx: any, width: number, height: number, images: any[] | null): void {
	const count = 24;
	ctx.save();
	ctx.globalAlpha = 0.35;
	for (let i = 0; i < count; i++) {
		const x = Math.random() * width;
		const y = Math.random() * height;
		const scale = 0.5 + Math.random() * 1.2;
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate((Math.random() - 0.5) * 0.8);
		if (images && images.length) {
			const img = images[i % images.length];
			const size = 18 * scale;
			ctx.drawImage(img, -size / 2, -size / 2, size, size);
		} else {
			ctx.font = 'bold 18px Inter, system-ui, -apple-system, Segoe UI, Arial';
			ctx.fillStyle = i % 3 === 0 ? 'rgba(236,72,153,0.6)' : 'rgba(14,165,233,0.6)';
			ctx.fillText('❤', 0, 0);
		}
		ctx.restore();
	}
	ctx.restore();
}

function drawSoftNoise(ctx: any, width: number, height: number): void {
	const dots = 320;
	ctx.save();
	ctx.globalAlpha = 0.08;
	for (let i = 0; i < dots; i++) {
		const x = Math.random() * width;
		const y = Math.random() * height;
		const r = Math.random() * 1.2 + 0.4;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fillStyle = 'white';
		ctx.fill();
	}
	ctx.restore();
}

const data = new SlashCommandBuilder()
	.setName('ask-olcer')
	.setDescription('İki kullanıcı arasında aşk/uyumluluk yüzdesini görsel olarak hesaplar')
	.setDMPermission(false)
	.addUserOption((opt) => opt.setName('kisi1').setDescription('Birinci kişi (boşsa siz)').setRequired(false))
	.addUserOption((opt) => opt.setName('kisi2').setDescription('İkinci kişi (boşsa rastgele/kendiniz)').setRequired(false))
	.addBooleanOption((opt) => opt.setName('gizli').setDescription('Yanıt sadece size görünsün (ephemeral)').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
		return;
	}
	const u1 = interaction.options.getUser('kisi1') ?? interaction.user;
	const u2 = interaction.options.getUser('kisi2') ?? (await pickRandomOther(interaction)) ?? interaction.user;
	const ephemeral = interaction.options.getBoolean('gizli') ?? false;

	const percent = seededPercent(u1.id, u2.id);
	const buffer = await drawLoveCard(u1, u2, percent);

	const fileName = 'askolcer.png';
	const embed = buildEmbed({
		title: 'Aşkölçer',
		description: `${u1} ❤ ${u2}`,
		imageUrl: `attachment://${fileName}`,
		footerText: formatFooter(interaction.guild.name),
		timestamp: true,
	});

	await interaction.reply({
		embeds: [embed],
		files: [{ attachment: buffer, name: fileName }],
		ephemeral,
		allowedMentions: { parse: [] },
	});
}

async function pickRandomOther(interaction: ChatInputCommandInteraction): Promise<User | null> {
	try {
		const members = await interaction.guild!.members.fetch({ withPresences: false });
		const pool = members.filter((m) => m.user.id !== interaction.user.id && !m.user.bot).map((m) => m.user);
		if (!pool.length) return null;
		return pool[Math.floor(Math.random() * pool.length)];
	} catch {
		return null;
	}
}

export default { data, execute };


