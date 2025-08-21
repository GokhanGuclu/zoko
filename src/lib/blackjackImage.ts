import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import type { BlackjackState, Card } from './blackjack';
import { handValue } from './blackjack';

try {
	GlobalFonts.registerFromPath(require('path').join(process.cwd(), 'assets', 'fonts', 'Inter-SemiBold.ttf'), 'Inter');
} catch {}

export async function renderBlackjack(
	state: BlackjackState,
	opts?: { revealDealerHole?: boolean }
): Promise<{ buffer: Buffer; fileName: string }>{
	const width = 900;
	const height = 620; // daha fazla alt boşluk
	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext('2d');

	// Arka plan
	const bg = ctx.createLinearGradient(0, 0, width, height);
	bg.addColorStop(0, '#0a2f1d');
	bg.addColorStop(1, '#064e3b');
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, width, height);

	// Başlık
	ctx.font = '700 28px Inter, system-ui, Segoe UI, Arial';
	ctx.fillStyle = 'rgba(255,255,255,0.95)';
	ctx.textAlign = 'center';
	ctx.fillText('Blackjack', width / 2, 42);

	// Dealer el + toplam
	ctx.font = '600 18px Inter, system-ui, Segoe UI, Arial';
	ctx.fillStyle = '#e5e7eb';
	const dealerVal = handValue(state.dealer).best;
	let dealerLabel: string;
	if (state.finished) {
		dealerLabel = `Krupiye • ${dealerVal}`;
	} else if (!opts?.revealDealerHole && state.dealer[0]) {
		dealerLabel = `Krupiye • ${visibleValueStr(state.dealer[0])} + ?`;
	} else {
		dealerLabel = `Krupiye • ${dealerVal}`;
	}
	ctx.fillText(dealerLabel, width / 2, 88);
	drawHand(ctx, state.dealer, width / 2, 114, state.finished || opts?.revealDealerHole ? 'reveal' : 'hide-second');

	// Oyuncu el + toplam (ortalı, aynı boyut)
	const playerVal = handValue(state.player).best;
	ctx.font = '600 18px Inter, system-ui, Segoe UI, Arial';
	ctx.fillStyle = '#e5e7eb';
	ctx.fillText(`Oyuncu • ${playerVal}`, width / 2, 324);
	drawHand(ctx, state.player, width / 2, 352, 'reveal');

	// Sonuç (kartların altı, çakışmasın)
	if (state.finished) {
		ctx.font = '700 26px Inter, system-ui, Segoe UI, Arial';
		ctx.fillStyle = state.result === 'player' ? '#22c55e' : (state.result === 'dealer' ? '#ef4444' : '#f59e0b');
		const txt = state.result === 'player' ? 'Oyuncu kazandı!' : (state.result === 'dealer' ? 'Krupiye kazandı!' : 'Berabere');
		ctx.fillText(txt, width / 2, 575);
	}

	return { buffer: canvas.toBuffer('image/png'), fileName: 'blackjack.png' };
}

function visibleValueStr(card: Card): string {
	if (card.rank === 'A') return 'A';
	if (['J', 'Q', 'K'].includes(card.rank)) return '10';
	return card.rank;
}

function drawHand(ctx: any, cards: Card[], centerX: number, top: number, mode: 'reveal' | 'hide-second') {
	const cardW = 120;
	const cardH = 170;
	const gap = 24;
	const totalW = cards.length * cardW + (cards.length - 1) * gap;
	let x = centerX - totalW / 2;
	for (let i = 0; i < cards.length; i++) {
		const c = cards[i];
		const hide = (mode === 'hide-second' && i === 1);
		drawCard(ctx, x, top, cardW, cardH, hide ? null : c);
		x += cardW + gap;
	}
}

function drawCard(ctx: any, x: number, y: number, w: number, h: number, card: Card | null) {
	const r = 14;
	// Gölge ve dış hat
	ctx.save();
	ctx.shadowColor = 'rgba(0,0,0,0.35)';
	ctx.shadowBlur = 18;
	ctx.shadowOffsetY = 8;
	roundedRect(ctx, x, y, w, h, r);
	ctx.fillStyle = '#f8fafc';
	ctx.fill();
	ctx.restore();
	ctx.lineWidth = 2.5;
	ctx.strokeStyle = '#0f172a';
	roundedRect(ctx, x, y, w, h, r);
	ctx.stroke();

	if (!card) {
		// Kapalı kart
		ctx.fillStyle = '#1f2937';
		ctx.fillRect(x + 10, y + 10, w - 20, h - 20);
		return;
	}

	const isRed = card.suit === '♥' || card.suit === '♦';
	const color = isRed ? '#b91c1c' : '#111827';
	ctx.fillStyle = color;
	// Köşe değerleri
	ctx.font = '700 26px Inter, system-ui, Segoe UI, Arial';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';
	ctx.fillText(`${card.rank}${card.suit}`, x + 16, y + 14);
	ctx.textAlign = 'right';
	ctx.textBaseline = 'bottom';
	ctx.fillText(`${card.rank}${card.suit}`, x + w - 16, y + h - 14);
	// Orta sembol
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = '700 64px Inter, system-ui, Segoe UI, Arial';
	ctx.fillText(`${card.suit}`, x + w / 2, y + h / 2 + 6);
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


