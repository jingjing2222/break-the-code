import { describe, expect, it } from "vitest";
import {
	chooseComputerTurn,
	DIFFICULTIES,
	evaluateQuestionAction,
	observeAnswer,
	questionPartitionStats,
	shouldGuess,
} from "./ai";
import { filterCandidates, makeInitialCandidates } from "./deduction";
import { askQuestion, createGame } from "./engine";
import {
	answerQuestion,
	generateLegalQuestionActions,
	QUESTION_CARDS,
} from "./questions";
import {
	createDeck,
	createSeededRandom,
	formatCode,
	sortCode,
	visibleCodeKey,
} from "./tiles";

describe("tiles", () => {
	it("creates 20 tiles and sorts by number then color rank", () => {
		const deck = createDeck();
		const sorted = sortCode([
			{ id: "B1", number: 1, color: "B" as const },
			{ id: "R1", number: 1, color: "R" as const },
			{ id: "G5a", number: 5, color: "G" as const },
			{ id: "R0", number: 0, color: "R" as const },
			{ id: "B9", number: 9, color: "B" as const },
		]);

		expect(deck).toHaveLength(20);
		expect(sorted.map((tile) => tile.id)).toEqual([
			"R0",
			"R1",
			"B1",
			"G5a",
			"B9",
		]);
	});
});

describe("candidate filtering", () => {
	it("starts from all possible opponent codes excluding only the AI code", () => {
		const deck = createDeck();
		const myTiles = sortCode(deck.slice(0, 5));
		const candidates = makeInitialCandidates(deck, myTiles);
		const myIds = new Set(myTiles.map((tile) => tile.id));

		expect(candidates).toHaveLength(3003);
		expect(
			candidates.every((code) => code.every((tile) => !myIds.has(tile.id))),
		).toBe(true);
	});

	it("creates a player knowledge model from the player's own tiles", () => {
		const state = createGame("advanced", createSeededRandom(5));
		const humanIds = new Set(state.humanCode.map((tile) => tile.id));

		expect(state.humanModel.candidates).toHaveLength(3003);
		expect(
			state.humanModel.candidates.every((code) =>
				code.every((tile) => !humanIds.has(tile.id)),
			),
		).toBe(true);
	});

	it("filters candidates by observed question answer", () => {
		const deck = createDeck();
		const myTiles = sortCode(deck.slice(0, 5));
		const candidates = makeInitialCandidates(deck, myTiles);
		const action = { cardId: "count-odd", isSharedInfo: false };
		const filtered = filterCandidates(candidates, action, 2);

		expect(filtered.length).toBeGreaterThan(0);
		expect(filtered.every((code) => answerQuestion(action, code) === 2)).toBe(
			true,
		);
	});
});

describe("questions", () => {
	it("generates parameterized actions and answers position questions", () => {
		const card = QUESTION_CARDS.find((item) => item.id === "where-number");
		const actions = generateLegalQuestionActions(card ? [card] : []);
		const code = sortCode([
			{ id: "R1", number: 1, color: "R" as const },
			{ id: "B1", number: 1, color: "B" as const },
			{ id: "R3", number: 3, color: "R" as const },
			{ id: "G5a", number: 5, color: "G" as const },
			{ id: "B9", number: 9, color: "B" as const },
		]);

		expect(actions).toHaveLength(10);
		expect(
			answerQuestion(
				{ cardId: "where-number", param: 1, isSharedInfo: false },
				code,
			),
		).toBe("A칸, B칸");
		expect(
			answerQuestion(
				{ cardId: "where-number", param: 4, isSharedInfo: false },
				code,
			),
		).toBe("없음");
	});
});

describe("AI", () => {
	it("keeps the computer object limited to fair information", () => {
		const state = createGame("advanced", createSeededRandom(7));

		expect(Object.keys(state.computer).sort()).toEqual([
			"candidates",
			"difficulty",
			"myCode",
		]);
		expect(state.computer.myCode).toEqual(state.computerCode);
		expect(state.computer).not.toHaveProperty("humanActualCode");
		expect(state.computer).not.toHaveProperty("unusedTiles");
	});

	it("updates candidates from the human answer without seeing the hidden code directly", () => {
		const state = createGame("advanced", createSeededRandom(3));
		const action = { cardId: "count-even", isSharedInfo: false };
		const answer = answerQuestion(action, state.humanCode);
		const nextComputer = observeAnswer(
			state.computer,
			action,
			answer,
			() => 0.99,
		);

		expect(nextComputer.candidates.length).toBeLessThan(
			state.computer.candidates.length,
		);
		expect(
			nextComputer.candidates.every(
				(code) => answerQuestion(action, code) === answer,
			),
		).toBe(true);
	});

	it("tracks what the player learns after asking the computer", () => {
		const state = createGame("advanced", createSeededRandom(19));
		const action = { cardId: "count-odd", isSharedInfo: false };
		const answer = answerQuestion(action, state.computerCode);
		const next = askQuestion({ ...state, turn: "human" }, "human", action);

		expect(next.humanModel.candidates.length).toBeLessThan(
			state.humanModel.candidates.length,
		);
		expect(
			next.humanModel.candidates.every(
				(code) => answerQuestion(action, code) === answer,
			),
		).toBe(true);
		expect(next.log[0].text).not.toContain("답은");
	});

	it("learns from the human side of a shared information question", () => {
		const state = createGame("advanced", createSeededRandom(17));
		const card = QUESTION_CARDS.find(
			(item) => item.id === "visible-key-at-position",
		);
		if (!card) {
			throw new Error("Missing shared information card");
		}

		const action = {
			cardId: card.id,
			param: 0,
			isSharedInfo: card.isSharedInfo,
		};
		const sharedAnswer = answerQuestion(action, state.humanCode);
		const next = askQuestion(
			{
				...state,
				turn: "human",
				visibleQuestionCards: [card],
				questionDeck: [],
			},
			"human",
			action,
		);

		expect(next.computer.candidates.length).toBeLessThan(
			state.computer.candidates.length,
		);
		expect(
			next.computer.candidates.every(
				(code) => answerQuestion(action, code) === sharedAnswer,
			),
		).toBe(true);
	});

	it("tracks what the player learns when the computer asks a shared question", () => {
		const state = createGame("advanced", createSeededRandom(29));
		const card = QUESTION_CARDS.find(
			(item) => item.id === "visible-key-at-position",
		);
		if (!card) {
			throw new Error("Missing shared information card");
		}

		const action = {
			cardId: card.id,
			param: 0,
			isSharedInfo: card.isSharedInfo,
		};
		const sharedAnswer = answerQuestion(action, state.computerCode);
		const next = askQuestion(
			{
				...state,
				turn: "computer",
				visibleQuestionCards: [card],
				questionDeck: [],
			},
			"computer",
			action,
		);

		expect(next.humanModel.candidates.length).toBeLessThan(
			state.humanModel.candidates.length,
		);
		expect(
			next.humanModel.candidates.every(
				(code) => answerQuestion(action, code) === sharedAnswer,
			),
		).toBe(true);
		expect(next.log[0].text).toContain(
			"컴퓨터가 내 암호의 A칸을 공개하라고 물었습니다.",
		);
		expect(next.log[0].text).not.toContain("공개된");
		expect(next.log[0].sharedAnswer).toBe(sharedAnswer);
		expect(next.log[0].text).not.toContain("A=");
	});

	it("guesses when visible candidates collapse to a single code", () => {
		const state = createGame("advanced", createSeededRandom(11));
		const guess = shouldGuess([state.humanCode], DIFFICULTIES.advanced);

		expect(guess ? visibleCodeKey(guess) : null).toBe(
			visibleCodeKey(state.humanCode),
		);
	});

	it("lets every difficulty use the player model at a different strength", () => {
		expect(DIFFICULTIES.beginner.opponentModelWeight).toBeLessThan(
			DIFFICULTIES.intermediate.opponentModelWeight,
		);
		expect(DIFFICULTIES.intermediate.opponentModelWeight).toBeLessThan(
			DIFFICULTIES.advanced.opponentModelWeight,
		);
		expect(DIFFICULTIES.advanced.opponentModelWeight).toBeLessThan(
			DIFFICULTIES.expert.opponentModelWeight,
		);
	});

	it("scores whether a question is useful for solving the current candidates", () => {
		const state = createGame("advanced", createSeededRandom(41));
		const candidates = [
			sortCode([
				{ id: "R0", number: 0, color: "R" as const },
				{ id: "B2", number: 2, color: "B" as const },
				{ id: "R4", number: 4, color: "R" as const },
				{ id: "B6", number: 6, color: "B" as const },
				{ id: "R8", number: 8, color: "R" as const },
			]),
			sortCode([
				{ id: "R1", number: 1, color: "R" as const },
				{ id: "B2", number: 2, color: "B" as const },
				{ id: "R4", number: 4, color: "R" as const },
				{ id: "B6", number: 6, color: "B" as const },
				{ id: "R8", number: 8, color: "R" as const },
			]),
		];
		const computer = { ...state.computer, candidates };
		const usefulAction = { cardId: "count-odd", isSharedInfo: false };
		const uselessAction = {
			cardId: "has-number",
			param: 9,
			isSharedInfo: false,
		};
		const useful = evaluateQuestionAction(computer, usefulAction, candidates);
		const useless = evaluateQuestionAction(computer, uselessAction, candidates);

		expect(
			questionPartitionStats(candidates, usefulAction).solveProbability,
		).toBe(1);
		expect(useful.isUseful).toBe(true);
		expect(useless.isUseful).toBe(false);
		expect(useful.score).toBeLessThan(useless.score);
	});

	it("treats a card as useful when it denies the player a strong question", () => {
		const state = createGame("expert", createSeededRandom(43));
		const selfCandidates = [
			sortCode([
				{ id: "R0", number: 0, color: "R" as const },
				{ id: "B2", number: 2, color: "B" as const },
				{ id: "R4", number: 4, color: "R" as const },
				{ id: "B6", number: 6, color: "B" as const },
				{ id: "R8", number: 8, color: "R" as const },
			]),
			sortCode([
				{ id: "B0", number: 0, color: "B" as const },
				{ id: "R2", number: 2, color: "R" as const },
				{ id: "B4", number: 4, color: "B" as const },
				{ id: "R6", number: 6, color: "R" as const },
				{ id: "B8", number: 8, color: "B" as const },
			]),
		];
		const playerCandidates = [
			selfCandidates[0],
			sortCode([
				{ id: "R1", number: 1, color: "R" as const },
				{ id: "B2", number: 2, color: "B" as const },
				{ id: "R4", number: 4, color: "R" as const },
				{ id: "B6", number: 6, color: "B" as const },
				{ id: "R8", number: 8, color: "R" as const },
			]),
		];
		const computer = { ...state.computer, candidates: selfCandidates };
		const action = { cardId: "count-odd", isSharedInfo: false };
		const value = evaluateQuestionAction(computer, action, selfCandidates, {
			model: { candidates: playerCandidates },
		});

		expect(value.own.expectedGain).toBe(0);
		expect(value.opponent?.expectedGain).toBeGreaterThan(0);
		expect(value.denyBonus).toBeGreaterThan(0);
		expect(value.isUseful).toBe(true);
	});

	it("allows expert forced guesses when the player is about to solve", () => {
		const state = createGame("expert", createSeededRandom(31));
		const guess = shouldGuess(
			[state.humanCode, state.computerCode],
			DIFFICULTIES.expert,
			{
				model: { candidates: [state.computerCode] },
				questionCardsRemaining: 4,
			},
		);

		expect(guess).not.toBeNull();
	});

	it("chooses a legal ask or guess action", () => {
		const state = createGame("expert", createSeededRandom(13));
		const decision = chooseComputerTurn(
			state.computer,
			state.visibleQuestionCards,
			() => 0.99,
		);

		expect(["ask", "guess", "pass"]).toContain(decision.type);
		if (decision.type === "ask") {
			expect(state.visibleQuestionCards.map((card) => card.id)).toContain(
				decision.action.cardId,
			);
		}
	});
});

describe("turn flow", () => {
	it("lets the human ask and hands the turn to the computer", () => {
		const state = createGame("intermediate", createSeededRandom(23));
		const humanState = { ...state, turn: "human" as const };
		const action = generateLegalQuestionActions(
			humanState.visibleQuestionCards,
		)[0];
		const next = askQuestion(humanState, "human", action);

		expect(next.turn).toBe("computer");
		expect(next.log[0].answer).toBeDefined();
		expect(formatCode(next.humanCode)).toContain("/");
	});
});
