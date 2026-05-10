import { chooseComputerTurn, DIFFICULTIES, observeAnswer } from "./ai";
import { filterCandidates, makeInitialCandidates } from "./deduction";
import {
	answerQuestion,
	formatAnswerForLog,
	formatQuestionForLog,
	generateLegalQuestionActions,
	QUESTION_CARDS,
} from "./questions";
import {
	createDeck,
	dealCodes,
	formatCode,
	shuffleTiles,
	visibleCodeKey,
} from "./tiles";
import type {
	Code,
	DifficultyName,
	GameLogEntry,
	GameState,
	Player,
	QuestionAction,
} from "./types";

function createLogEntry(entry: Omit<GameLogEntry, "id">): GameLogEntry {
	return {
		...entry,
		id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
	};
}

function drawQuestionCards(
	questionDeck: readonly (typeof QUESTION_CARDS)[number][],
	count: number,
) {
	return {
		drawn: questionDeck.slice(0, count),
		remaining: questionDeck.slice(count),
	};
}

function replaceQuestionCard(state: GameState, cardId: string) {
	const visibleQuestionCards = state.visibleQuestionCards.filter(
		(card) => card.id !== cardId,
	);

	if (state.questionDeck.length === 0) {
		return {
			questionDeck: state.questionDeck,
			visibleQuestionCards,
		};
	}

	const [nextCard, ...questionDeck] = state.questionDeck;

	return {
		questionDeck,
		visibleQuestionCards: [...visibleQuestionCards, nextCard],
	};
}

export function createGame(
	difficultyName: DifficultyName,
	random = Math.random,
	startingPlayerOverride?: Player,
): GameState {
	const deck = createDeck();
	const { humanCode, computerCode } = dealCodes(deck, random);
	const shuffledQuestions = shuffleTiles(QUESTION_CARDS, random);
	const { drawn, remaining } = drawQuestionCards(shuffledQuestions, 6);
	const startingPlayer =
		startingPlayerOverride ?? (random() < 0.5 ? "human" : "computer");

	return {
		deck,
		humanCode,
		computerCode,
		questionDeck: remaining,
		visibleQuestionCards: drawn,
		computer: {
			myCode: computerCode,
			candidates: makeInitialCandidates(deck, computerCode),
			difficulty: DIFFICULTIES[difficultyName],
		},
		humanModel: {
			candidates: makeInitialCandidates(deck, humanCode),
		},
		turn: startingPlayer,
		status: "playing",
		startingPlayer,
		turnNumber: 1,
		log: [
			createLogEntry({
				actor: "human",
				kind: "system",
				text: `${DIFFICULTIES[difficultyName].label} 난이도로 새 게임을 시작했습니다. 선공은 ${
					startingPlayer === "human" ? "플레이어" : "컴퓨터"
				}입니다.`,
			}),
		],
	};
}

function nextTurn(current: Player) {
	return current === "human" ? "computer" : "human";
}

export function askQuestion(
	state: GameState,
	actor: Player,
	action: QuestionAction,
): GameState {
	if (state.status !== "playing" || state.turn !== actor) return state;

	const targetCode = actor === "human" ? state.computerCode : state.humanCode;
	const answer = answerQuestion(action, targetCode);
	const sharedAnswer = action.isSharedInfo
		? answerQuestion(
				action,
				actor === "human" ? state.humanCode : state.computerCode,
			)
		: undefined;
	const replacement = replaceQuestionCard(state, action.cardId);
	const computer =
		actor === "computer"
			? observeAnswer(state.computer, action, answer)
			: sharedAnswer === undefined
				? state.computer
				: observeAnswer(state.computer, action, sharedAnswer);
	const humanModel =
		actor === "human"
			? {
					candidates: filterCandidates(
						state.humanModel.candidates,
						action,
						answer,
					),
				}
			: sharedAnswer === undefined
				? state.humanModel
				: {
						candidates: filterCandidates(
							state.humanModel.candidates,
							action,
							sharedAnswer,
						),
					};
	const sharedText = action.isSharedInfo
		? ` 함께 공개된 ${actor === "human" ? "플레이어" : "컴퓨터"}의 답은 ${formatAnswerForLog(sharedAnswer)}입니다.`
		: "";
	const actorLabel = actor === "human" ? "플레이어" : "컴퓨터";
	const answerText = formatAnswerForLog(answer);
	const exhausted =
		replacement.visibleQuestionCards.length === 0 &&
		replacement.questionDeck.length === 0;

	return {
		...state,
		...replacement,
		computer,
		humanModel,
		lastAnswer: answer,
		turn: exhausted ? state.turn : nextTurn(actor),
		status: exhausted ? "exhausted" : state.status,
		turnNumber: actor === "computer" ? state.turnNumber + 1 : state.turnNumber,
		log: [
			createLogEntry({
				actor,
				kind: "ask",
				text: `${actorLabel}가 ${formatQuestionForLog(action, actor)} 답은 ${answerText}입니다.${sharedText}`,
				answer,
				candidatesAfter:
					actor === "computer" ? computer.candidates.length : undefined,
			}),
			...state.log,
		],
	};
}

export function guessCode(
	state: GameState,
	actor: Player,
	guess: Code,
): GameState {
	if (state.status !== "playing" || state.turn !== actor) return state;

	const targetCode = actor === "human" ? state.computerCode : state.humanCode;
	const correct = visibleCodeKey(guess) === visibleCodeKey(targetCode);
	const status = correct
		? actor === "human"
			? "human-won"
			: "computer-won"
		: state.status;

	return {
		...state,
		turn: correct ? state.turn : nextTurn(actor),
		status,
		turnNumber: actor === "computer" ? state.turnNumber + 1 : state.turnNumber,
		log: [
			createLogEntry({
				actor,
				kind: "guess",
				text: `${actor === "human" ? "플레이어" : "컴퓨터"} 추측: ${formatCode(guess)}. ${
					correct ? "정답입니다." : "오답입니다."
				}`,
				candidatesAfter:
					actor === "computer" ? state.computer.candidates.length : undefined,
			}),
			...state.log,
		],
	};
}

export function runComputerTurn(
	state: GameState,
	random = Math.random,
): GameState {
	if (state.status !== "playing" || state.turn !== "computer") return state;

	const decision = chooseComputerTurn(
		state.computer,
		state.visibleQuestionCards,
		random,
		{
			model: state.humanModel,
			questionCardsRemaining: state.questionDeck.length,
		},
	);

	if (decision.type === "guess") {
		return guessCode(state, "computer", decision.code);
	}

	if (decision.type === "ask") {
		return askQuestion(state, "computer", decision.action);
	}

	return {
		...state,
		status: "exhausted",
		log: [
			createLogEntry({
				actor: "computer",
				kind: "system",
				text: "컴퓨터가 선택할 질문이 없어 게임이 종료되었습니다.",
			}),
			...state.log,
		],
	};
}

export function getDefaultHumanGuess(state: GameState) {
	return state.humanCode.map((tile, index) => ({
		...tile,
		id: `guess-${index}-${tile.id}`,
	}));
}

export function getLegalActionsForCard(state: GameState, cardId: string) {
	return generateLegalQuestionActions(state.visibleQuestionCards).filter(
		(action) => action.cardId === cardId,
	);
}
