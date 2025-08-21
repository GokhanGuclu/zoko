export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card { suit: Suit; rank: Rank }

export interface BlackjackState {
	deck: Card[];
	player: Card[];
	dealer: Card[];
	finished: boolean;
	result: 'player' | 'dealer' | 'push' | null;
	createdAt: number;
}

const contextIdToState: Map<string, BlackjackState> = new Map();

export function getBlackjackContextId(guildId: string | null, channelId: string, userId: string): string {
	return `${guildId ?? 'dm'}:${channelId}:${userId}`;
}

export function startBlackjack(ctx: string): BlackjackState {
	const deck = buildShuffledDeck();
	const state: BlackjackState = {
		deck,
		player: [deck.pop()!, deck.pop()!],
		dealer: [deck.pop()!, deck.pop()!],
		finished: false,
		result: null,
		createdAt: Date.now(),
	};
	// Doğal blackjack kontrolü
	const player21 = handValue(state.player).best === 21;
	const dealer21 = handValue(state.dealer).best === 21;
	if (player21 || dealer21) {
		state.finished = true;
		state.result = player21 && !dealer21 ? 'player' : (!player21 && dealer21 ? 'dealer' : 'push');
	}
	contextIdToState.set(ctx, state);
	return state;
}

export function getBlackjack(ctx: string): BlackjackState | null {
	return contextIdToState.get(ctx) ?? null;
}

export function hitBlackjack(ctx: string): BlackjackState | null {
	const s = contextIdToState.get(ctx);
	if (!s || s.finished) return s ?? null;
	s.player.push(s.deck.pop()!);
	const v = handValue(s.player).best;
	if (v > 21) {
		s.finished = true;
		s.result = 'dealer';
	}
	return s;
}

export function standBlackjack(ctx: string): BlackjackState | null {
	const s = contextIdToState.get(ctx);
	if (!s || s.finished) return s ?? null;
	// Animasyonlu akış için burada bitirmiyoruz, sadece state'i döndürüyoruz.
	return s;
}

// Dealer'ı bir adım ilerletir. done=true ise el bitmiştir.
export function dealerStep(ctx: string): { done: boolean; state: BlackjackState | null } {
	const s = contextIdToState.get(ctx);
	if (!s) return { done: true, state: null };
	if (s.finished) return { done: true, state: s };
	const { best, soft } = handValue(s.dealer);
	if (best > 21 || best > 17 || (best === 17 && !soft)) {
		const pv = handValue(s.player).best;
		const dv = best;
		if (dv > 21) s.result = 'player';
		else if (pv > dv) s.result = 'player';
		else if (pv < dv) s.result = 'dealer';
		else s.result = 'push';
		s.finished = true;
		return { done: true, state: s };
	}
	// Bir kart çek
	s.dealer.push(s.deck.pop()!);
	return { done: false, state: s };
}

export function resetBlackjack(ctx: string): void {
	contextIdToState.delete(ctx);
}

export function handValue(cards: Card[]): { best: number; soft: boolean; totals: number[] } {
	let total = 0;
	let aces = 0;
	for (const c of cards) {
		if (c.rank === 'A') {
			aces++;
			total += 11;
		} else if (['J', 'Q', 'K'].includes(c.rank)) {
			total += 10;
		} else {
			total += Number(c.rank);
		}
	}
	let soft = false;
	while (total > 21 && aces > 0) {
		total -= 10; // bir A'yı 11'den 1'e çevir
		aces--;
	}
	soft = cards.some((c) => c.rank === 'A') && total <= 21 && total + 10 <= 21; // bilgilendirme amaçlı
	return { best: total, soft, totals: [total] };
}

function buildShuffledDeck(): Card[] {
	const suits: Suit[] = ['♠', '♥', '♦', '♣'];
	const ranks: Rank[] = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
	const deck: Card[] = [];
	for (const s of suits) for (const r of ranks) deck.push({ suit: s, rank: r });
	for (let i = deck.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[deck[i], deck[j]] = [deck[j], deck[i]];
	}
	return deck;
}


