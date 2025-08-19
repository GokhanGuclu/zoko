import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';

// Font kaydı (mevcut değilse sistem fontlarına düşer)
try {
	GlobalFonts.registerFromPath(require('path').join(process.cwd(), 'assets', 'fonts', 'Inter-SemiBold.ttf'), 'Inter');
} catch {}

export type InfoField = { name: string; value: string };

export async function renderInfoCardPng(options: { title: string; subtitle?: string; avatarUrl?: string | null; fields: InfoField[] }): Promise<{ buffer: Buffer; fileName: string }> {
	const width = 1100;
	const padX = 48;
	const padY = 72;
	const gutter = 22;
	const colWidth = Math.floor((width - padX * 2 - gutter) / 2);
	const headerHeight = 70;
	const tilePad = 24;
	const sectionGap = 22;
	const nameFont = '700 20px Inter, system-ui, -apple-system, Segoe UI, Arial';
	const valueFont = '500 20px Inter, system-ui, -apple-system, Segoe UI, Arial';
	const nameLH = 28;
	const lineLH = 26;

	// Ön ölçüm: her field için yükseklik
	const fieldHeights: number[] = options.fields.map((f) => {
		const lines = f.value.split('\n');
		const linesCount = Math.max(1, lines.length);
		const textHeight = nameLH + 16 /* başlık-alt boşluk */ + linesCount * (lineLH + 8) /* pill aralığı ile birlikte */;
		return tilePad * 2 + textHeight;
	});

	// Masonry: iki sütun yerleşimi
	let leftY = padY + headerHeight;
	let rightY = padY + headerHeight;
	const placements: Array<{ x: number; y: number; h: number }> = [];
	for (let i = 0; i < fieldHeights.length; i++) {
		const h = fieldHeights[i] + 6; // alt boşluk
		if (leftY <= rightY) {
			placements.push({ x: padX, y: leftY, h });
			leftY += h + sectionGap;
		} else {
			placements.push({ x: padX + colWidth + gutter, y: rightY, h });
			rightY += h + sectionGap;
		}
	}
	const contentBottom = Math.max(leftY, rightY);
	const height = contentBottom + padY;

	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext('2d');

	// Arkaplan gradient
	const bg = ctx.createLinearGradient(0, 0, width, height);
	bg.addColorStop(0, '#0b1020');
	bg.addColorStop(1, '#6d28d9');
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, width, height);

	// Başlık + alt başlık
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = 'rgba(255,255,255,0.95)';
	ctx.font = '800 34px Inter, system-ui, -apple-system, Segoe UI, Arial';
	ctx.fillText(options.title, padX, padY);
	if (options.subtitle) {
		ctx.font = '500 18px Inter, system-ui, -apple-system, Segoe UI, Arial';
		ctx.fillStyle = 'rgba(255,255,255,0.85)';
		ctx.fillText(options.subtitle, padX, padY + 28);
	}
	// Avatar (varsa)
	if (options.avatarUrl) {
		try {
			const img = await loadImage(options.avatarUrl);
			const size = 64;
			const x = width - padX - size;
			const y = padY - 10;
			ctx.save();
			ctx.beginPath();
			ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
			ctx.closePath();
			ctx.clip();
			ctx.drawImage(img as any, x, y, size, size);
			ctx.restore();
		} catch {}
	}

	// Field kartları
	for (let i = 0; i < options.fields.length; i++) {
		const field = options.fields[i];
		const place = placements[i];
		const x = place.x;
		const y = place.y;
		const w = colWidth;
		const lines = field.value.split('\n');
		const boxH = fieldHeights[i];

		// Kutu
		roundRect(ctx, x, y, w, boxH, 12);
		ctx.fillStyle = 'rgba(15,23,42,0.55)';
		ctx.fill();
		ctx.lineWidth = 1.5;
		ctx.strokeStyle = 'rgba(255,255,255,0.07)';
		ctx.stroke();


		// Başlık
		ctx.font = nameFont;
		ctx.fillStyle = 'rgba(255,255,255,0.9)';
		const titleY = y + tilePad + nameLH;
		ctx.fillText(field.name, x + tilePad, titleY);

		// Değerler (pill)
		ctx.font = valueFont;
		ctx.fillStyle = 'rgba(255,255,255,0.95)';
		let cy = titleY + 16; // başlıktan sonra ekstra boşluk
		for (const line of lines) {
			const text = line.trim();
			if (!text) { cy += lineLH; continue; }
			const tw = ctx.measureText(text).width;
			const px = x + tilePad;
			const py = cy + 20; // metin taban çizgisini biraz aşağı al
			roundRect(ctx, px - 8, py - 20, tw + 16, 28, 8); // 28px pil yüksekliği
			ctx.fillStyle = 'rgba(255,255,255,0.10)';
			ctx.fill();
			ctx.fillStyle = 'rgba(255,255,255,0.95)';
			ctx.fillText(text, px, py);
			cy += lineLH + 8; // pill arası ekstra boşluk
		}
	}

	return { buffer: canvas.toBuffer('image/png'), fileName: 'bot-info.png' };
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


