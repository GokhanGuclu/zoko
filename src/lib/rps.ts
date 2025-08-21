export type RpsChoice = 'rock' | 'paper' | 'scissors';

export type RpsRound = {
  round: number;
  choiceX: RpsChoice | null;
  choiceO: RpsChoice | null;
  winner: 'X' | 'O' | 'tie' | null;
};

export type RpsState = {
  contextId: string; // guildId:channelId or dm:channel
  token: string; // short token to use in customIds
  playerXId: string; // initiator is X
  playerOId: string; // user id or 'bot'
  versusBot: boolean;
  bestOf: 3 | 5;
  currentRound: number; // 1-based
  scoreX: number;
  scoreO: number;
  finished: boolean;
  winner: 'X' | 'O' | 'tie' | null;
  rounds: RpsRound[];
  messageId: string | null; // public game message id to update
  selectMsgIdX?: string | null;
  selectMsgIdO?: string | null;
  createdAt: number;
};

const contextToState = new Map<string, RpsState>();
const tokenToContext = new Map<string, string>();

export function getRpsContextId(guildId: string | null, channelId: string): string {
  return guildId ? `${guildId}:${channelId}` : `dm:${channelId}`;
}

export function startRps(contextId: string, playerXId: string, playerOId: string, bestOf: 3 | 5, token: string): RpsState {
  const state: RpsState = {
    contextId,
    token,
    playerXId,
    playerOId,
    versusBot: playerOId === 'bot',
    bestOf,
    currentRound: 1,
    scoreX: 0,
    scoreO: 0,
    finished: false,
    winner: null,
    rounds: [],
    messageId: null,
    createdAt: Date.now(),
  };
  contextToState.set(contextId, state);
  tokenToContext.set(token, contextId);
  return state;
}

export function getRps(contextId: string): RpsState | undefined {
  return contextToState.get(contextId);
}

export function getRpsByToken(token: string): RpsState | undefined {
  const ctx = tokenToContext.get(token);
  return ctx ? contextToState.get(ctx) : undefined;
}

export function setRpsMessageId(token: string, messageId: string): void {
  const st = getRpsByToken(token);
  if (st) st.messageId = messageId;
}

export function cancelRps(contextId: string): boolean {
  const st = contextToState.get(contextId);
  if (!st) return false;
  tokenToContext.delete(st.token);
  return contextToState.delete(contextId);
}

export function submitChoice(token: string, userId: string, choice: RpsChoice): { state?: RpsState; error?: string; resultReady?: boolean; round?: RpsRound } {
  const state = getRpsByToken(token);
  if (!state) return { error: 'Aktif bir TKM oyunu yok.' };
  if (state.finished) return { error: 'Oyun bitti.' };

  // Determine role for user
  const role: 'X' | 'O' | null = (userId === state.playerXId) ? 'X' : (userId === state.playerOId ? 'O' : null);
  if (!role && !(state.versusBot && userId === state.playerXId)) {
    return { error: 'Bu oyunda yer almıyorsun.' };
  }

  // Ensure current round exists
  let round = state.rounds.find(r => r.round === state.currentRound);
  if (!round) {
    round = { round: state.currentRound, choiceX: null, choiceO: null, winner: null };
    state.rounds.push(round);
  }

  if (role === 'X') {
    if (round.choiceX) return { error: 'Bu tur için seçim yaptın.' };
    round.choiceX = choice;
  } else if (role === 'O') {
    if (round.choiceO) return { error: 'Bu tur için seçim yaptın.' };
    round.choiceO = choice;
  } else if (state.versusBot && userId === state.playerXId) {
    // In bot mode, this branch shouldn't trigger; we already set role X above.
  }

  // If versus bot and O is bot, pick immediately if needed
  if (state.versusBot && state.playerOId === 'bot' && !round.choiceO) {
    round.choiceO = randomChoice();
  }

  // If both choices present → compute result
  if (round.choiceX && round.choiceO) {
    round.winner = whoWins(round.choiceX, round.choiceO);
    if (round.winner === 'X') state.scoreX += 1;
    if (round.winner === 'O') state.scoreO += 1;

    // Berabere ise bu turu sayma ve tekrar et (round dizisinden kaldır)
    if (round.winner === 'tie') {
      const idx = state.rounds.indexOf(round);
      if (idx >= 0) state.rounds.splice(idx, 1);
      // currentRound aynı kalsın
      return { state, resultReady: true };
    }

    // Check finish: first to majority (berabere dışı)
    const need = Math.floor(state.bestOf / 2) + 1;
    if (state.scoreX >= need || state.scoreO >= need || state.currentRound >= state.bestOf) {
      state.finished = true;
      state.winner = state.scoreX === state.scoreO ? 'tie' : (state.scoreX > state.scoreO ? 'X' : 'O');
    } else {
      state.currentRound += 1;
    }
    return { state, resultReady: true, round };
  }

  return { state, resultReady: false, round };
}

export function whoWins(a: RpsChoice, b: RpsChoice): 'X' | 'O' | 'tie' {
  if (a === b) return 'tie';
  if ((a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper')) return 'X';
  return 'O';
}

function randomChoice(): RpsChoice {
  const arr: RpsChoice[] = ['rock', 'paper', 'scissors'];
  return arr[Math.floor(Math.random() * arr.length)];
}


