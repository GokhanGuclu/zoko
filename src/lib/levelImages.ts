import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';

try {
	GlobalFonts.registerFromPath(require('path').join(process.cwd(), 'assets', 'fonts', 'Inter-SemiBold.ttf'), 'Inter');
} catch {}

export async function renderRankCard(options: {
	username: string;
	avatarUrl?: string | null;
	level: number;
	xpTotal: number;
	xpCurrentLevel: number;
	xpNeeded: number;
	rank: number | null;
	status?: 'online' | 'idle' | 'dnd' | 'offline' | null;
}): Promise<{ buffer: Buffer; fileName: string }>{
	const width = 1100;
	const height = 380;
	const pad = 32;
	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext('2d');

	// Arkaplan + highlight
	const bg = ctx.createLinearGradient(0, 0, width, height);
	bg.addColorStop(0, '#0b1020');
	bg.addColorStop(1, '#6d28d9');
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, width, height);
	const glow = ctx.createRadialGradient(width - 200, 80, 0, width - 200, 80, 400);
	glow.addColorStop(0, 'rgba(167,139,250,0.35)');
	glow.addColorStop(1, 'rgba(167,139,250,0)');
	ctx.fillStyle = glow;
	ctx.fillRect(0, 0, width, height);

	// Cam panel
	ctx.save();
	ctx.shadowColor = 'rgba(0,0,0,0.4)';
	ctx.shadowBlur = 24;
	roundRect(ctx, pad, pad, width - pad * 2, height - pad * 2, 22);
	ctx.fillStyle = 'rgba(255,255,255,0.06)';
	ctx.fill();
	ctx.shadowBlur = 0;
	ctx.strokeStyle = 'rgba(255,255,255,0.12)';
	ctx.lineWidth = 1.5;
	ctx.stroke();
	ctx.restore();

	// Avatar
	if (options.avatarUrl) {
		try {
			const img = await loadImage(options.avatarUrl);
			const size = 120;
			const x = pad + 12;
			const y = pad + 16;
			ctx.save();
			ctx.beginPath();
			ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
			ctx.closePath();
			ctx.clip();
			ctx.drawImage(img as any, x, y, size, size);
			ctx.restore();
			// Halka
			ctx.beginPath();
			ctx.arc(x + size / 2, y + size / 2, size / 2 + 4, 0, Math.PI * 2);
			ctx.strokeStyle = 'rgba(167,139,250,0.9)';
			ctx.lineWidth = 4;
			ctx.stroke();
			// Durum rozeti
			const status = options.status || null;
			const dotOuter = 16;
			const dotInner = 12;
			const dotX = x + size - 4;
			const dotY = y + size - 4;
			const color = status === 'online' ? '#22c55e' : status === 'idle' ? '#f59e0b' : status === 'dnd' ? '#ef4444' : '#6b7280';
			ctx.beginPath();
			ctx.arc(dotX, dotY, dotOuter / 2, 0, Math.PI * 2);
			ctx.fillStyle = 'white';
			ctx.fill();
			ctx.beginPath();
			ctx.arc(dotX, dotY, dotInner / 2, 0, Math.PI * 2);
			ctx.fillStyle = color;
			ctx.fill();
		} catch {}
	}

	// Metinler
	const textX = pad + 160;
	ctx.fillStyle = 'rgba(255,255,255,0.96)';
	ctx.font = '800 42px Inter, system-ui, -apple-system, Segoe UI, Arial';
	ctx.fillText(options.username, textX, pad + 70);
	ctx.font = '800 30px Inter, system-ui, -apple-system, Segoe UI, Arial';
	ctx.fillText(`Seviye ${options.level}`, textX, pad + 110);

	// Sağ üst: büyük sıralama geri
	if (options.rank) {
		ctx.textAlign = 'right';
		ctx.font = '900 52px Inter, system-ui, -apple-system, Segoe UI, Arial';
		ctx.fillStyle = 'rgba(255,255,255,0.95)';
		ctx.fillText(`#${options.rank}`, width - pad - 10, pad + 68);
		ctx.textAlign = 'left';
	}

	// Progress bar
	const barX = pad + 24;
	const barY = height - pad - 72; // daha aşağıda
	const barW = width - (pad + 24) * 2;
	const barH = 20; // daha ince bar
	const pct = Math.max(0, Math.min(1, options.xpNeeded > 0 ? options.xpCurrentLevel / options.xpNeeded : 0));

	// Arka bar
	roundRect(ctx, barX, barY, barW, barH, 12);
	ctx.fillStyle = 'rgba(255,255,255,0.12)';
	ctx.fill();

	// Dolum
	const fillW = Math.max(8, Math.floor(barW * pct));
	const grad = ctx.createLinearGradient(barX, barY, barX + fillW, barY + barH);
	grad.addColorStop(0, '#a78bfa');
	grad.addColorStop(1, '#6366f1');
	roundRect(ctx, barX, barY, fillW, barH, 12);
	ctx.fillStyle = grad;
	ctx.fill();

	ctx.font = '600 16px Inter, system-ui, -apple-system, Segoe UI, Arial';
	ctx.fillStyle = 'rgba(255,255,255,0.95)';
	ctx.textAlign = 'left';
	ctx.fillText('Seviye İlerlemesi', barX, barY - 12);
	ctx.textAlign = 'right';
	ctx.fillText(`${Math.round(pct * 100)}% • ${options.xpCurrentLevel}/${options.xpNeeded} XP`, barX + barW, barY - 12);

	return { buffer: canvas.toBuffer('image/png'), fileName: 'rank.png' };
}

export async function renderLeaderboard(options: {
	title: string;
	rows: Array<{ rank: number; username: string; level: number; xp: number; avatarUrl?: string | null }>; 
}): Promise<{ buffer: Buffer; fileName: string }>{
	const width = 1000;
	const rowH = 72;
	const pad = 28;
	const header = 88;
	const height = header + pad + options.rows.length * (rowH + 12) + pad;
	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext('2d');

	const bg = ctx.createLinearGradient(0, 0, width, height);
	bg.addColorStop(0, '#0b1020');
	bg.addColorStop(1, '#6d28d9');
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, width, height);
	const glow = ctx.createRadialGradient(width - 220, 60, 0, width - 220, 60, 380);
	glow.addColorStop(0, 'rgba(167,139,250,0.35)');
	glow.addColorStop(1, 'rgba(167,139,250,0)');
	ctx.fillStyle = glow;
	ctx.fillRect(0, 0, width, height);

	ctx.fillStyle = 'rgba(255,255,255,0.95)';
	ctx.font = '800 32px Inter, system-ui, -apple-system, Segoe UI, Arial';
	ctx.fillText(options.title, pad, pad + 40);

	let y = header;
	for (const row of options.rows) {
		// satır cam panel
		ctx.save();
		ctx.shadowColor = 'rgba(0,0,0,0.35)';
		ctx.shadowBlur = 18;
		roundRect(ctx, pad, y - 6, width - pad * 2, rowH, 14);
		ctx.fillStyle = 'rgba(255,255,255,0.06)';
		ctx.fill();
		ctx.shadowBlur = 0;
		ctx.strokeStyle = 'rgba(255,255,255,0.10)';
		ctx.lineWidth = 1;
		ctx.stroke();
		ctx.restore();

		// avatar
		if (row.avatarUrl) {
			try {
				const img = await loadImage(row.avatarUrl);
				const size = 48;
				ctx.save();
				ctx.beginPath();
				ctx.arc(pad + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
				ctx.closePath();
				ctx.clip();
				ctx.drawImage(img as any, pad, y, size, size);
				ctx.restore();
			} catch {}
		}
		// metinler
		ctx.font = '700 20px Inter, system-ui, -apple-system, Segoe UI, Arial';
		ctx.fillStyle = 'rgba(255,255,255,0.95)';
		ctx.fillText(`#${row.rank} • ${row.username}`, pad + 64, y + 30);
		ctx.font = '500 18px Inter, system-ui, -apple-system, Segoe UI, Arial';
		ctx.fillText(`Seviye ${row.level} • ${row.xp.toLocaleString('tr-TR')} XP`, pad + 64, y + 54);
		y += rowH + 12;
	}

	return { buffer: canvas.toBuffer('image/png'), fileName: 'leaderboard.png' };
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number): void {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}


