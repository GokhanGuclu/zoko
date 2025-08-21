import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import type { LetterMark, WordleState } from './wordle';

// Font kaydı (opsiyonel). Mevcut değilse sistem fontları kullanılır.
try {
	GlobalFonts.registerFromPath(require('path').join(process.cwd(), 'assets', 'fonts', 'Inter-SemiBold.ttf'), 'Inter');
} catch {}

export async function renderBoardPng(state: WordleState): Promise<{ buffer: Buffer; fileName: string }>{
	const tile = 78; // karenin bir kenarı
	const gap = 12; // kare arası boşluk
	const padX = 40;
	const padY = 80; // üstte başlık için yer
	const width = padX * 2 + state.length * tile + (state.length - 1) * gap;
	const brandPad = 26; // altta marka için ekstra yer
	const height = padY + padX + state.maxAttempts * tile + (state.maxAttempts - 1) * gap + brandPad;

	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext('2d');

	// Arkaplan gradient
	const bg = ctx.createLinearGradient(0, 0, width, height);
	bg.addColorStop(0, '#0b1020');
	bg.addColorStop(1, '#6d28d9');
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, width, height);

	// Başlık
	ctx.font = '700 28px Inter, system-ui, -apple-system, Segoe UI, Arial';
	ctx.fillStyle = 'rgba(255,255,255,0.9)';
	ctx.textAlign = 'center';
	ctx.fillText(`Wordle-TR • ${state.length} harf • ${state.maxAttempts} hak`, width / 2, 44);

	// Tahta
	const startX = padX;
	const startY = padY;

	for (let r = 0; r < state.maxAttempts; r++) {
		for (let c = 0; c < state.length; c++) {
			const x = startX + c * (tile + gap);
			const y = startY + r * (tile + gap);
			const inRow = r < state.rows.length;
			const ch = inRow ? (state.rows[r].letters[c] ?? '') : '';
			const mark: LetterMark | 'empty' = inRow ? (state.rows[r].marks[c] ?? 'empty') : 'empty';

			const { fill, border, text } = getTileColors(mark as any);
			// kare
			roundRect(ctx, x, y, tile, tile, 10);
			ctx.fillStyle = fill;
			ctx.fill();
			ctx.lineWidth = 2;
			ctx.strokeStyle = border;
			ctx.stroke();

			// harf
			if (ch) {
				ctx.font = '700 36px Inter, system-ui, -apple-system, Segoe UI, Arial';
				ctx.fillStyle = text;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(ch.toUpperCase(), x + tile / 2, y + tile / 2 + 2);
			}
		}
	}

	// Alt bilgi (tamamlandıysa sonuç)
	ctx.font = '600 22px Inter, system-ui, -apple-system, Segoe UI, Arial';
	ctx.textAlign = 'center';
	ctx.fillStyle = 'rgba(255,255,255,0.9)';
	if (state.finished) {
		ctx.fillText(state.success ? 'Tebrikler!' : `Doğru kelime: ${state.target.toUpperCase()}`, width / 2, height - 52);
	} else {
		ctx.fillText('Tahmin etmeye devam edin…', width / 2, height - 52);
	}

	// Marka
	ctx.font = '600 16px Inter, system-ui, -apple-system, Segoe UI, Arial';
	ctx.fillStyle = 'rgba(255,255,255,0.55)';
	ctx.fillText('ZoKo Games', width / 2, height - 18);

	return { buffer: canvas.toBuffer('image/png'), fileName: 'wordle-board.png' };
}

function getTileColors(mark: LetterMark | 'empty'): { fill: string; border: string; text: string } {
	if (mark === 'correct') return { fill: '#22c55e', border: '#16a34a', text: '#0b1020' };
	if (mark === 'present') return { fill: '#f59e0b', border: '#d97706', text: '#111827' };
	if (mark === 'absent') return { fill: '#334155', border: '#475569', text: '#e2e8f0' };
	return { fill: 'rgba(15,23,42,0.6)', border: '#475569', text: '#94a3b8' };
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


