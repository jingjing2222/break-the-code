import {
	bucketCandidates,
	distinctAnswerCount,
	expectedRemaining,
	filterCandidates,
	getVisibleCandidateGroups,
	worstCaseRemaining,
} from "./deduction";
import { answerQuestion, generateLegalQuestionActions } from "./questions";
import type {
	Answer,
	Code,
	ComputerPlayer,
	DifficultyConfig,
	DifficultyName,
	QuestionAction,
	QuestionCard,
} from "./types";

export const DIFFICULTIES = {
	beginner: {
		name: "beginner",
		label: "초급",
		useFullCandidateFiltering: true,
		clueDropRate: 0.2,
		randomMoveRate: 0.65,
		sampleLimit: 150,
		scoreMode: "random_or_simple",
		guessMode: "risky",
		guessConfidence: 0.65,
		sharedInfoPenalty: 0,
		lookaheadDepth: 0,
		denyOpponentGoodCards: false,
	},
	intermediate: {
		name: "intermediate",
		label: "중급",
		useFullCandidateFiltering: true,
		clueDropRate: 0.05,
		randomMoveRate: 0.25,
		sampleLimit: 800,
		scoreMode: "distinct_answer_count",
		guessMode: "mostly_safe",
		guessConfidence: 0.85,
		sharedInfoPenalty: 0.5,
		lookaheadDepth: 0,
		denyOpponentGoodCards: false,
	},
	advanced: {
		name: "advanced",
		label: "고급",
		useFullCandidateFiltering: true,
		clueDropRate: 0,
		randomMoveRate: 0.08,
		sampleLimit: Number.POSITIVE_INFINITY,
		scoreMode: "expected_remaining",
		guessMode: "safe",
		guessConfidence: 1,
		sharedInfoPenalty: 1.5,
		lookaheadDepth: 0,
		denyOpponentGoodCards: false,
	},
	expert: {
		name: "expert",
		label: "전문가",
		useFullCandidateFiltering: true,
		clueDropRate: 0,
		randomMoveRate: 0.01,
		sampleLimit: Number.POSITIVE_INFINITY,
		scoreMode: "minimax_plus_lookahead",
		guessMode: "safe_or_forced",
		guessConfidence: 1,
		sharedInfoPenalty: 2,
		lookaheadDepth: 2,
		denyOpponentGoodCards: true,
	},
} satisfies Record<DifficultyName, DifficultyConfig>;

function randomChoice<T>(items: readonly T[], random = Math.random) {
	return items[Math.floor(random() * items.length)];
}

function randomSample<T>(
	items: readonly T[],
	limit: number,
	random = Math.random,
) {
	if (!Number.isFinite(limit) || items.length <= limit) return [...items];

	const pool = [...items];
	const sample: T[] = [];

	while (sample.length < limit && pool.length > 0) {
		const index = Math.floor(random() * pool.length);
		sample.push(pool[index]);
		pool.splice(index, 1);
	}

	return sample;
}

function minBy<T>(items: readonly T[], score: (item: T) => number) {
	return items.reduce((best, item) =>
		score(item) < score(best) ? item : best,
	);
}

function maxBy<T>(items: readonly T[], score: (item: T) => number) {
	return items.reduce((best, item) =>
		score(item) > score(best) ? item : best,
	);
}

function rarityScore(
	action: QuestionAction,
	answer: Answer,
	universe: readonly Code[],
) {
	const matching = universe.filter(
		(code) => String(answerQuestion(action, code)) === String(answer),
	).length;
	if (matching === 0) return 5;

	return universe.length / matching;
}

export function getSharedInfoLeakPenalty(
	action: QuestionAction,
	myCode: Code,
	universe: readonly Code[],
) {
	if (!action.isSharedInfo) return 0;

	const myAnswer = answerQuestion(action, myCode);
	return rarityScore(action, myAnswer, universe);
}

function getDenyBonus(action: QuestionAction, candidates: readonly Code[]) {
	if (!action.isSharedInfo) return 0;
	return (
		worstCaseRemaining(candidates, action) / Math.max(candidates.length, 1)
	);
}

export function lookaheadScore(
	candidates: readonly Code[],
	actions: readonly QuestionAction[],
	depth: number,
	myCode: Code,
	universe: readonly Code[],
) {
	if (depth === 0 || candidates.length <= 1) return candidates.length;

	let best = Number.POSITIVE_INFINITY;

	for (const action of actions) {
		const buckets = bucketCandidates(candidates, action);
		let expectedAfter = 0;

		for (const bucket of buckets.values()) {
			const probability = bucket.length / candidates.length;
			expectedAfter +=
				probability *
				lookaheadScore(bucket, actions, depth - 1, myCode, universe);
		}

		const score =
			expectedAfter + getSharedInfoLeakPenalty(action, myCode, universe);
		if (score < best) best = score;
	}

	return best;
}

export function shouldGuess(
	candidates: readonly Code[],
	difficulty: DifficultyConfig,
) {
	const groups = getVisibleCandidateGroups(candidates);
	const total = candidates.length;
	const sorted = [...groups.values()]
		.map((group) => ({
			probability: group.length / total,
			representative: group[0],
		}))
		.sort((a, b) => b.probability - a.probability);

	const best = sorted[0];
	if (!best) return null;
	if (groups.size === 1) return best.representative;

	if (
		(difficulty.guessMode === "risky" ||
			difficulty.guessMode === "mostly_safe") &&
		best.probability >= difficulty.guessConfidence
	) {
		return best.representative;
	}

	if (
		difficulty.guessMode === "safe_or_forced" &&
		candidates.length <= 2 &&
		best.probability >= 0.5
	) {
		return best.representative;
	}

	return null;
}

export function observeAnswer(
	computer: ComputerPlayer,
	action: QuestionAction,
	answer: Answer,
	random = Math.random,
) {
	if (random() < computer.difficulty.clueDropRate) return computer;

	return {
		...computer,
		candidates: filterCandidates(computer.candidates, action, answer),
	};
}

export function chooseQuestionAction(
	computer: ComputerPlayer,
	visibleQuestionCards: readonly QuestionCard[],
	random = Math.random,
) {
	const actions = generateLegalQuestionActions(visibleQuestionCards);
	if (actions.length === 0) return null;

	if (random() < computer.difficulty.randomMoveRate)
		return randomChoice(actions, random);

	const candidates = randomSample(
		computer.candidates,
		computer.difficulty.sampleLimit,
		random,
	);

	if (computer.difficulty.scoreMode === "distinct_answer_count") {
		return maxBy(actions, (action) => distinctAnswerCount(candidates, action));
	}

	if (computer.difficulty.scoreMode === "minimax_plus_lookahead") {
		return minBy(actions, (action) => {
			const buckets = bucketCandidates(candidates, action);
			let expectedFuture = 0;

			for (const bucket of buckets.values()) {
				const probability = bucket.length / candidates.length;
				expectedFuture +=
					probability *
					lookaheadScore(
						bucket,
						actions,
						1,
						computer.myCode,
						computer.candidates,
					);
			}

			const worst = worstCaseRemaining(candidates, action);
			const leak =
				getSharedInfoLeakPenalty(action, computer.myCode, computer.candidates) *
				computer.difficulty.sharedInfoPenalty;
			const deny = computer.difficulty.denyOpponentGoodCards
				? getDenyBonus(action, candidates) * 0.5
				: 0;

			return expectedFuture + worst * 0.35 + leak - deny;
		});
	}

	return minBy(actions, (action) => {
		const informationScore = expectedRemaining(candidates, action);
		const leak =
			getSharedInfoLeakPenalty(action, computer.myCode, computer.candidates) *
			computer.difficulty.sharedInfoPenalty;
		return informationScore + leak;
	});
}

export function chooseComputerTurn(
	computer: ComputerPlayer,
	visibleQuestionCards: readonly QuestionCard[],
	random = Math.random,
) {
	const guess = shouldGuess(computer.candidates, computer.difficulty);
	if (guess) return { type: "guess", code: guess } as const;

	const action = chooseQuestionAction(computer, visibleQuestionCards, random);
	if (!action) return { type: "pass" } as const;

	return { type: "ask", action } as const;
}
