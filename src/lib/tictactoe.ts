export type TttCell = 'X' | 'O' | null;

export type TttState = {
	contextId: string;
	board: TttCell[]; // 9 hücre
	turn: 'X' | 'O';
	playerXId: string; // başlatan oyuncu genelde X
	playerOId: string; // 'bot' olabilir
	versusBot: boolean;
	finished: boolean;
	winner: 'X' | 'O' | 'tie' | null;
	createdAt: number;
};

const contextIdToState: Map<string, TttState> = new Map();

export function getTttContextId(guildId: string | null, channelId: string): string {
	return guildId ? `${guildId}:${channelId}` : `dm:${channelId}`;
}

export function startTtt(contextId: string, playerXId: string, playerOId: string, versusBot: boolean): TttState {
	const state: TttState = {
		contextId,
		board: new Array(9).fill(null),
		turn: 'X',
		playerXId,
		playerOId,
		versusBot,
		finished: false,
		winner: null,
		createdAt: Date.now(),
	};
	contextIdToState.set(contextId, state);
	return state;
}

export function getTtt(contextId: string): TttState | undefined {
	return contextIdToState.get(contextId);
}

export function cancelTtt(contextId: string): boolean {
	return contextIdToState.delete(contextId);
}

export function makeMove(contextId: string, byUserId: string, index: number): { state?: TttState; error?: string } {
	const state = contextIdToState.get(contextId);
	if (!state) return { error: 'Aktif bir X-O-X oyunu yok.' };
	if (state.finished) return { error: 'Oyun bitti.' };
	if (index < 0 || index > 8) return { error: 'Geçersiz hamle.' };

	const expectedUserId = state.turn === 'X' ? state.playerXId : state.playerOId;
	if (state.versusBot && expectedUserId === 'bot') {
		return { error: 'Sıra botta.' };
	}
	if (byUserId !== expectedUserId) {
		return { error: 'Sıra sizde değil.' };
	}
	if (state.board[index] !== null) {
		return { error: 'Bu hücre dolu.' };
	}

	state.board[index] = state.turn;
	evaluateEnd(state);
	if (!state.finished) {
		state.turn = state.turn === 'X' ? 'O' : 'X';
	}

	// Bot hamlesi (varsa)
	if (!state.finished && state.versusBot && state.turn === 'O' && state.playerOId === 'bot') {
		const botIndex = chooseBotMove(state);
		if (botIndex !== -1) {
			state.board[botIndex] = 'O';
			evaluateEnd(state);
			if (!state.finished) state.turn = 'X';
		}
	}

	return { state };
}

function evaluateEnd(state: TttState): void {
	const winner = computeWinner(state.board);
	if (winner) {
		state.finished = true;
		state.winner = winner;
		return;
	}
	if (state.board.every((c) => c !== null)) {
		state.finished = true;
		state.winner = 'tie';
	}
}

export function computeWinner(board: TttCell[]): 'X' | 'O' | null {
	const lines = [
		[0, 1, 2],
		[3, 4, 5],
		[6, 7, 8],
		[0, 3, 6],
		[1, 4, 7],
		[2, 5, 8],
		[0, 4, 8],
		[2, 4, 6],
	] as const;
	for (const [a, b, c] of lines) {
		if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
	}
	return null;
}

function chooseBotMove(state: TttState): number {
	// Basit strateji: kazan → engelle → merkez → köşeler → kenarlar
	const opponent: 'X' | 'O' = 'X';
	const self: 'X' | 'O' = 'O';

	// Kazanma fırsatı
	let idx = findWinningMove(state.board, self);
	if (idx !== -1) return idx;
	// Engelleme
	idx = findWinningMove(state.board, opponent);
	if (idx !== -1) return idx;
	// Merkez
	if (state.board[4] === null) return 4;
	// Köşeler
	for (const i of [0, 2, 6, 8]) if (state.board[i] === null) return i;
	// Kenarlar
	for (const i of [1, 3, 5, 7]) if (state.board[i] === null) return i;
	return -1;
}

function findWinningMove(board: TttCell[], mark: 'X' | 'O'): number {
	const lines = [
		[0, 1, 2],
		[3, 4, 5],
		[6, 7, 8],
		[0, 3, 6],
		[1, 4, 7],
		[2, 5, 8],
		[0, 4, 8],
		[2, 4, 6],
	] as const;
	for (const [a, b, c] of lines) {
		const line = [board[a], board[b], board[c]];
		const empties = [a, b, c].filter((i, k) => line[k] === null);
		const marks = line.filter((v) => v === mark).length;
		if (empties.length === 1 && marks === 2) return empties[0];
	}
	return -1;
}


