import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import type { RpsState, RpsRound, RpsChoice } from './rps';

try {
  GlobalFonts.registerFromPath(require('path').join(process.cwd(), 'assets', 'fonts', 'Inter-SemiBold.ttf'), 'Inter');
} catch {}

// Emoji'ler canvas'ta kare (tofu) olarak çıkabildiği için vektörel ikonlar çiziyoruz.

export async function renderRps(state: RpsState, opts: {
  playerX: { name: string; avatarUrl?: string | null };
  playerO: { name: string; avatarUrl?: string | null };
}): Promise<{ buffer: Buffer; fileName: string }>{
  const width = 900;
  const height = 300; // daha kısa görüntü, alt boşluğu daha da azalt
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#0b1020');
  bg.addColorStop(1, '#1f2937');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.textAlign = 'center';
  ctx.font = '800 32px Inter, system-ui, Segoe UI, Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillText('Taş • Kağıt • Makas', width / 2, 44);

  // Players top row
  const sidePad = 28;
  const avatar = 60;
  const topY = 70;
  const ringX = state.finished
    ? (state.winner === 'X' ? '#22c55e' : state.winner === 'O' ? '#ef4444' : '#6b7280')
    : 'rgba(255,255,255,0.35)';
  await drawAvatar(ctx, sidePad, topY, avatar, opts.playerX.avatarUrl || undefined, ringX);
  ctx.textAlign = 'left';
  ctx.font = '700 18px Inter, system-ui, Segoe UI, Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillText(`${opts.playerX.name}`, sidePad + avatar + 12, topY + 30);
  ctx.font = '500 14px Inter, system-ui, Segoe UI, Arial';
  ctx.fillStyle = '#e5e7eb';
  ctx.fillText(`Skor: ${state.scoreX}`, sidePad + avatar + 12, topY + 50);

  const rightX = width - sidePad - avatar;
  const ringO = state.finished
    ? (state.winner === 'O' ? '#22c55e' : state.winner === 'X' ? '#ef4444' : '#6b7280')
    : 'rgba(255,255,255,0.35)';
  await drawAvatar(ctx, rightX, topY, avatar, opts.playerO.avatarUrl || undefined, ringO);
  ctx.textAlign = 'right';
  ctx.font = '700 18px Inter, system-ui, Segoe UI, Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillText(`${opts.playerO.name}`, rightX - 12, topY + 30);
  ctx.font = '500 14px Inter, system-ui, Segoe UI, Arial';
  ctx.fillStyle = '#e5e7eb';
  ctx.fillText(`Skor: ${state.scoreO}`, rightX - 12, topY + 50);

  // Center current round info (beraberlikler turdan sayılmaz)
  ctx.textAlign = 'center';
  ctx.font = '700 20px Inter, system-ui, Segoe UI, Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const best = state.bestOf;
  const playedNonTie = state.scoreX + state.scoreO;
  const curDisplay = Math.min(state.finished ? playedNonTie : playedNonTie + 1, best);
  ctx.fillText(`Tur ${curDisplay} / ${best}`, width / 2, 96);

  // Rounds summary (last up to 5)
  const summaryY = 145; // sonuç kutuları — kompakt
  const cellW = 150;
  let x = (width - cellW * best - 16 * (best - 1)) / 2;
  for (let i = 0; i < best; i++) {
    const round = state.rounds[i];
    drawRoundCell(ctx, x, summaryY, cellW, 70, round);
    x += cellW + 16;
  }

  // Footer
  ctx.font = '600 16px Inter, system-ui, Segoe UI, Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('ZoKo Games', width / 2, height - 18);

  return { buffer: canvas.toBuffer('image/png'), fileName: `tkm-${Date.now()}.png` };
}

function drawRoundCell(ctx: any, x: number, y: number, w: number, h: number, round?: RpsRound) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.font = '600 18px Inter, system-ui, Segoe UI, Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  if (!round) {
    ctx.fillText('-', x + w / 2, y + h / 2 + 6);
    return;
  }
  const cx = x + w / 2;
  const cy = y + h / 2 + 6;
  drawRpsIcon(ctx, cx - 38, cy - 18, 22, round.choiceX);
  ctx.font = '700 16px Inter, system-ui, Segoe UI, Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('vs', cx, cy - 2);
  drawRpsIcon(ctx, cx + 18, cy - 18, 22, round.choiceO);
}

function drawRpsIcon(ctx: any, x: number, y: number, size: number, choice?: RpsChoice | null) {
  ctx.save();
  const s = size;
  if (!choice) {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    roundRect(ctx, x, y, s, s, 6);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (choice === 'rock') {
    // Kaya
    ctx.fillStyle = '#9ca3af';
    ctx.beginPath();
    ctx.moveTo(x + 2, y + s - 2);
    ctx.lineTo(x + s - 2, y + s - 2);
    ctx.lineTo(x + s - 6, y + 7);
    ctx.lineTo(x + s / 2, y + 2);
    ctx.lineTo(x + 6, y + 9);
    ctx.closePath();
    ctx.fill();
  } else if (choice === 'paper') {
    // Kağıt
    ctx.fillStyle = '#e5e7eb';
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    roundRect(ctx, x + 2, y + 2, s - 4, s - 4, 4);
    ctx.fill();
    ctx.stroke();
    // Kıvrım
    ctx.beginPath();
    ctx.moveTo(x + s - 8, y + 2);
    ctx.lineTo(x + s - 2, y + 8);
    ctx.stroke();
  } else if (choice === 'scissors') {
    // Makas
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 3);
    ctx.lineTo(x + s - 3, y + s - 3);
    ctx.moveTo(x + 3, y + s - 3);
    ctx.lineTo(x + s - 3, y + 3);
    ctx.stroke();
    // Parmak halkaları
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(x + 5, y + s - 6, 3, 0, Math.PI * 2);
    ctx.arc(x + 11, y + s - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

async function drawAvatar(ctx: any, x: number, y: number, size: number, url?: string, ringColor?: string) {
  if (url) {
    try {
      const img = await loadImage(url);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img as any, x, y, size, size);
      ctx.restore();
    } catch {}
  }
  // Ring
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 + 4, 0, Math.PI * 2);
  ctx.strokeStyle = ringColor || 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 4;
  ctx.stroke();
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}


