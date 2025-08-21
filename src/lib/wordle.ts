import { pickRandomTRWord, TR_WORDS } from './wordlist-tr';

export type LetterMark = 'absent' | 'present' | 'correct';

export type GuessRow = {
	letters: string[];
	marks: LetterMark[];
};

export type WordleState = {
	contextId: string; // guildId:channelId veya DM channel id
	target: string;
	length: number;
	maxAttempts: number;
	rows: GuessRow[];
	finished: boolean;
	success: boolean;
	messageId?: string | null;
};

const contextIdToState: Map<string, WordleState> = new Map();

export function toContextId(guildId: string | null, channelId: string): string {
	return guildId ? `${guildId}:${channelId}` : `dm:${channelId}`;
}

export function startWordle(contextId: string, length: number = 5, maxAttempts: number = 6): WordleState {
	const chosen = pickRandomTRWord(Math.max(5, Math.min(7, length)), Math.max(5, Math.min(7, length)));
	const state: WordleState = {
		contextId,
		target: normalizeTR(chosen),
		length: chosen.length,
		maxAttempts,
		rows: [],
		finished: false,
		success: false,
		messageId: null,
	};
	contextIdToState.set(contextId, state);
	return state;
}

export function getWordle(contextId: string): WordleState | undefined {
	return contextIdToState.get(contextId);
}

export function cancelWordle(contextId: string): boolean {
	return contextIdToState.delete(contextId);
}

export function setWordleMessageId(contextId: string, messageId: string): void {
	const st = contextIdToState.get(contextId);
	if (st) st.messageId = messageId;
}

export function guessWord(contextId: string, guessRaw: string): { state?: WordleState; error?: string; row?: GuessRow } {
	const state = contextIdToState.get(contextId);
	if (!state) return { error: 'Bu kanalda aktif bir oyun yok. Önce başlatın.' };
	if (state.finished) return { error: 'Oyun zaten bitti. Yeni oyun başlatın.' };
	const guess = normalizeTR(guessRaw);
	if (guess.length !== state.length) return { error: `Kelime uzunluğu ${state.length} olmalı.` };
	// İsteğe bağlı: kelimenin havuzda olup olmadığı
	if (!TR_WORDS.includes(guess)) {
		// Yine de oynamaya izin veriyoruz, sadece uyarı niteliğinde
		// return { error: 'Bu kelime sözlükte yok.' };
	}

	const row = evaluateGuess(guess, state.target);
	state.rows.push(row);

	if (row.marks.every((m) => m === 'correct')) {
		state.finished = true;
		state.success = true;
	} else if (state.rows.length >= state.maxAttempts) {
		state.finished = true;
		state.success = false;
	}

	return { state, row };
}

export function evaluateGuess(guess: string, target: string): GuessRow {
	const letters = [...guess];
	const marks: LetterMark[] = new Array(letters.length).fill('absent');
	const targetArr = [...target];
	const remaining: Record<string, number> = {};

	// Önce doğru pozisyonları işaretle
	for (let i = 0; i < letters.length; i++) {
		if (letters[i] === targetArr[i]) {
			marks[i] = 'correct';
		} else {
			remaining[targetArr[i]] = (remaining[targetArr[i]] || 0) + 1;
		}
	}
	// Sonra mevcut-hatalı pozisyonları işaretle
	for (let i = 0; i < letters.length; i++) {
		if (marks[i] !== 'correct') {
			const ch = letters[i];
			if (remaining[ch] > 0) {
				marks[i] = 'present';
				remaining[ch]--;
			} else {
				marks[i] = 'absent';
			}
		}
	}
	return { letters, marks };
}

export function renderBoard(state: WordleState): string {
	const map: Record<LetterMark, string> = {
		correct: '🟩',
		present: '🟨',
		absent: '⬜',
	};
	const lines = state.rows.map((r) => r.marks.map((m) => map[m]).join(''));
	const empty = '▫️'.repeat(state.length);
	for (let i = state.rows.length; i < state.maxAttempts; i++) {
		lines.push(empty);
	}
	return lines.join('\n');
}

export function normalizeTR(input: string): string {
	// TR diline uygun küçük harfe çevir
	return input.trim().toLocaleLowerCase('tr-TR');
}


