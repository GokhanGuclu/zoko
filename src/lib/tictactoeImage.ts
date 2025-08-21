import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import type { TttState, TttCell } from './tictactoe';

try {
	GlobalFonts.registerFromPath(require('path').join(process.cwd(), 'assets', 'fonts', 'Inter-SemiBold.ttf'), 'Inter');
} catch {}

type RenderOptions = {
	lastMoveIndex?: number | null;
	playerX: { name: string; avatarUrl?: string | null };
	playerO: { name: string; avatarUrl?: string | null };
};

export async function renderTtt(state: TttState, opts: RenderOptions): Promise<{ buffer: Buffer; fileName: string }>{
	const width = 820;
	const height = 600; // alta daha fazla boşluk
	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext('2d');

	// Arka plan gradyan
	const bg = ctx.createLinearGradient(0, 0, width, height);
	bg.addColorStop(0, '#0c1b2a');
	bg.addColorStop(1, '#111827');
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, width, height);

	// Başlık
	ctx.font = '700 28px Inter, system-ui, Segoe UI, Arial';
	ctx.textAlign = 'center';
	ctx.fillStyle = 'rgba(255,255,255,0.95)';
	ctx.fillText('X-O-X', width / 2, 44);

	// Üst tarafta oyuncular: sol X, sağ O
	const sidePad = 20;
	const avatarSize = 60;
	const topY = 70;
	// X oyuncusu
	if (opts.playerX?.avatarUrl) {
		try {
			const img = await loadImage(opts.playerX.avatarUrl);
			ctx.save();
			ctx.beginPath();
			ctx.arc(sidePad + avatarSize / 2, topY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
			ctx.closePath();
			ctx.clip();
			ctx.drawImage(img as any, sidePad, topY, avatarSize, avatarSize);
			ctx.restore();
			// Halka (sırası olan parlak)
			ctx.beginPath();
			ctx.arc(sidePad + avatarSize / 2, topY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
			ctx.strokeStyle = state.finished ? 'rgba(255,255,255,0.6)' : (state.turn === 'X' ? '#22c55e' : 'rgba(255,255,255,0.35)');
			ctx.lineWidth = 4;
			ctx.stroke();
		} catch {}
	}
	ctx.font = '700 18px Inter, system-ui, Segoe UI, Arial';
	ctx.fillStyle = 'rgba(255,255,255,0.92)';
	ctx.textAlign = 'left';
	ctx.fillText(`X • ${opts.playerX?.name ?? 'Oyuncu X'}`, sidePad + avatarSize + 12, topY + 30);
	ctx.font = '500 14px Inter, system-ui, Segoe UI, Arial';
	ctx.fillStyle = '#e5e7eb';
	ctx.fillText(state.finished ? (state.winner === 'X' ? 'Kazanan' : (state.winner === 'tie' ? 'Berabere' : '')) : (state.turn === 'X' ? 'Sıra onda' : ''), sidePad + avatarSize + 12, topY + 52);

	// O oyuncusu sağ üst
	const rightX = width - sidePad - avatarSize;
	if (opts.playerO?.avatarUrl) {
		try {
			const img = await loadImage(opts.playerO.avatarUrl);
			ctx.save();
			ctx.beginPath();
			ctx.arc(rightX + avatarSize / 2, topY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
			ctx.closePath();
			ctx.clip();
			ctx.drawImage(img as any, rightX, topY, avatarSize, avatarSize);
			ctx.restore();
			ctx.beginPath();
			ctx.arc(rightX + avatarSize / 2, topY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
			ctx.strokeStyle = state.finished ? 'rgba(255,255,255,0.6)' : (state.turn === 'O' ? '#22c55e' : 'rgba(255,255,255,0.35)');
			ctx.lineWidth = 4;
			ctx.stroke();
		} catch {}
	}
	ctx.textAlign = 'right';
	ctx.font = '700 18px Inter, system-ui, Segoe UI, Arial';
	ctx.fillStyle = 'rgba(255,255,255,0.92)';
	ctx.fillText(`O • ${opts.playerO?.name ?? 'Oyuncu O'}`, rightX - 12, topY + 30);
	ctx.font = '500 14px Inter, system-ui, Segoe UI, Arial';
	ctx.fillStyle = '#e5e7eb';
	ctx.fillText(state.finished ? (state.winner === 'O' ? 'Kazanan' : (state.winner === 'tie' ? 'Berabere' : '')) : (state.turn === 'O' ? 'Sıra onda' : ''), rightX - 12, topY + 52);

	// Grid alanı
	const gridSize = 420;
	const gridX = (width - gridSize) / 2;
	const gridY = 140;

	// Hücre boyutu
	const cell = gridSize / 3;

	// Hücre zeminleri: boş = mavi, X = kırmızı, O = yeşil
	for (let r = 0; r < 3; r++) {
		for (let c = 0; c < 3; c++) {
			const i = r * 3 + c;
			const v: TttCell = state.board[i];
			let color = '#1f3a8a'; // mavi ton
			if (v === 'X') color = '#b91c1c'; // kırmızı
			if (v === 'O') color = '#065f46'; // yeşil
			const x = gridX + c * cell;
			const y = gridY + r * cell;
			ctx.fillStyle = color;
			roundedRect(ctx, x + 6, y + 6, cell - 12, cell - 12, 12);
			ctx.fill();
			// Son hamleyi vurgula
			if (opts?.lastMoveIndex === i) {
				ctx.strokeStyle = 'rgba(255,255,255,0.85)';
				ctx.lineWidth = 4;
				roundedRect(ctx, x + 6, y + 6, cell - 12, cell - 12, 12);
				ctx.stroke();
			}
		}
	}

	// X / O sembolleri (ikonik çizim)
	for (let r = 0; r < 3; r++) {
		for (let c = 0; c < 3; c++) {
			const i = r * 3 + c;
			const v: TttCell = state.board[i];
			if (!v) continue;
			const x = gridX + c * cell + cell / 2;
			const y = gridY + r * cell + cell / 2;
			if (v === 'X') {
				drawX(ctx, x, y, cell * 0.42);
			} else {
				drawO(ctx, x, y, cell * 0.36);
			}
		}
	}

	// Alt marka yazısı
	ctx.textAlign = 'center';
	ctx.font = '600 16px Inter, system-ui, Segoe UI, Arial';
	ctx.fillStyle = 'rgba(255,255,255,0.55)';
	ctx.fillText('ZoKo Games', width / 2, height - 18);

	const buffer = canvas.toBuffer('image/png');
	return { buffer, fileName: `xox-${Date.now()}.png` };
}

function roundedRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

function drawX(ctx: any, cx: number, cy: number, size: number) {
	ctx.save();
	ctx.strokeStyle = 'rgba(255,255,255,0.92)';
	ctx.lineWidth = 10;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(cx - size, cy - size);
	ctx.lineTo(cx + size, cy + size);
	ctx.moveTo(cx + size, cy - size);
	ctx.lineTo(cx - size, cy + size);
	ctx.stroke();
	ctx.restore();
}

function drawO(ctx: any, cx: number, cy: number, radius: number) {
	ctx.save();
	ctx.strokeStyle = 'rgba(255,255,255,0.92)';
	ctx.lineWidth = 10;
	ctx.beginPath();
	ctx.arc(cx, cy, radius, 0, Math.PI * 2);
	ctx.stroke();
	ctx.restore();
}


