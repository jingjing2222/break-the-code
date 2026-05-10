import {
	bucketCandidates,
	filterCandidates,
	getVisibleCandidateGroups,
} from "./deduction";
import { answerQuestion, generateLegalQuestionActions } from "./questions";
import type {
	Answer,
	Code,
	ComputerPlayer,
	DifficultyConfig,
	DifficultyName,
	OpponentModel,
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
		opponentModelWeight: 0.05,
		worstCaseWeight: 0,
		solveChanceWeight: 0.1,
		opponentDenyWeight: 0.05,
		forcedGuessOpponentConfidence: 0.98,
		forcedGuessSelfConfidence: 0.65,
		forcedGuessQuestionThreshold: 0,
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
		opponentModelWeight: 0.25,
		worstCaseWeight: 0.05,
		solveChanceWeight: 0.25,
		opponentDenyWeight: 0.15,
		forcedGuessOpponentConfidence: 0.92,
		forcedGuessSelfConfidence: 0.75,
		forcedGuessQuestionThreshold: 1,
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
		opponentModelWeight: 0.6,
		worstCaseWeight: 0.15,
		solveChanceWeight: 0.5,
		opponentDenyWeight: 0.4,
		forcedGuessOpponentConfidence: 0.85,
		forcedGuessSelfConfidence: 0.85,
		forcedGuessQuestionThreshold: 2,
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
		opponentModelWeight: 1,
		worstCaseWeight: 0.35,
		solveChanceWeight: 0.75,
		opponentDenyWeight: 1,
		forcedGuessOpponentConfidence: 0.75,
		forcedGuessSelfConfidence: 0.5,
		forcedGuessQuestionThreshold: 4,
	},
} satisfies Record<DifficultyName, DifficultyConfig>;

type OpponentContext = {
	model?: OpponentModel;
	questionCardsRemaining?: number;
	visibleActions?: readonly QuestionAction[];
};

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

function safeRatio(value: number, total: number) {
	if (total <= 0) return 0;
	return value / total;
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

function getSharedInfoLeakPenalty(
	action: QuestionAction,
	myCode: Code,
	universe: readonly Code[],
) {
	if (!action.isSharedInfo) return 0;

	const myAnswer = answerQuestion(action, myCode);
	return rarityScore(action, myAnswer, universe);
}

function opponentThreatLevel(opponentCandidates: readonly Code[]) {
	const groups = getVisibleCandidateGroups(opponentCandidates);
	const total = opponentCandidates.length;
	const bestProbability =
		total === 0
			? 0
			: Math.max(...[...groups.values()].map((group) => group.length / total));

	return {
		visibleGroups: groups.size,
		bestProbability,
		candidateCount: total,
	};
}

export function questionPartitionStats(
	candidates: readonly Code[],
	action: QuestionAction,
) {
	const buckets = bucketCandidates(candidates, action);
	const total = candidates.length;
	let expectedAfter = 0;
	let solveProbability = 0;
	let worstAfter = 0;

	for (const bucket of buckets.values()) {
		const probability = safeRatio(bucket.length, total);
		expectedAfter += probability * bucket.length;
		worstAfter = Math.max(worstAfter, bucket.length);

		if (getVisibleCandidateGroups(bucket).size === 1) {
			solveProbability += probability;
		}
	}

	return {
		distinctAnswers: buckets.size,
		expectedAfter,
		worstAfter,
		expectedGain: Math.max(0, total - expectedAfter),
		worstGain: Math.max(0, total - worstAfter),
		solveProbability,
	};
}

export function evaluateQuestionAction(
	computer: ComputerPlayer,
	action: QuestionAction,
	candidates: readonly Code[],
	context: OpponentContext = {},
) {
	const difficulty = computer.difficulty;
	const own = questionPartitionStats(candidates, action);
	const total = Math.max(candidates.length, 1);
	const opponentCandidates = context.model?.candidates;
	const opponent = opponentCandidates
		? questionPartitionStats(opponentCandidates, action)
		: null;
	const opponentDanger = opponent
		? safeRatio(
				opponent.expectedGain + opponent.worstGain * 0.25,
				opponentCandidates?.length ?? 1,
			)
		: 0;
	const leakPenalty =
		safeRatio(
			getSharedInfoLeakPenalty(action, computer.myCode, computer.candidates),
			Math.max(computer.candidates.length, 1),
		) * difficulty.sharedInfoPenalty;
	const solveBonus = own.solveProbability * difficulty.solveChanceWeight;
	const denyBonus =
		opponentDanger *
		difficulty.opponentModelWeight *
		difficulty.opponentDenyWeight;

	let baseScore: number;

	if (difficulty.scoreMode === "distinct_answer_count") {
		baseScore = -own.distinctAnswers;
	} else if (difficulty.scoreMode === "minimax_plus_lookahead") {
		const actions = context.visibleActions ?? [action];
		const buckets = bucketCandidates(candidates, action);
		let expectedFuture = 0;

		for (const bucket of buckets.values()) {
			const probability = safeRatio(bucket.length, candidates.length);
			expectedFuture +=
				probability *
				lookaheadScore(
					bucket,
					actions,
					Math.max(0, difficulty.lookaheadDepth - 1),
					computer.myCode,
					computer.candidates,
				);
		}

		baseScore =
			safeRatio(expectedFuture, total) +
			safeRatio(own.worstAfter, total) * difficulty.worstCaseWeight;
	} else {
		baseScore =
			safeRatio(own.expectedAfter, total) +
			safeRatio(own.worstAfter, total) * difficulty.worstCaseWeight;
	}

	return {
		action,
		own,
		opponent,
		leakPenalty,
		solveBonus,
		denyBonus,
		score: baseScore + leakPenalty - solveBonus - denyBonus,
		isUseful: own.expectedGain > 0 || own.solveProbability > 0 || denyBonus > 0,
	};
}

function lookaheadScore(
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
	context: OpponentContext = {},
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

	const opponentCandidates = context.model?.candidates;
	if (opponentCandidates && difficulty.opponentModelWeight > 0) {
		const threat = opponentThreatLevel(opponentCandidates);
		const lowQuestionPressure =
			(context.questionCardsRemaining ?? Number.POSITIVE_INFINITY) <=
			difficulty.forcedGuessQuestionThreshold;
		const opponentIsClose =
			threat.visibleGroups === 1 ||
			(lowQuestionPressure &&
				threat.bestProbability >= difficulty.forcedGuessOpponentConfidence);

		if (
			opponentIsClose &&
			best.probability >= difficulty.forcedGuessSelfConfidence
		) {
			return best.representative;
		}
	}

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

function chooseQuestionAction(
	computer: ComputerPlayer,
	visibleQuestionCards: readonly QuestionCard[],
	random = Math.random,
	context: OpponentContext = {},
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

	return minBy(
		actions,
		(action) =>
			evaluateQuestionAction(computer, action, candidates, {
				...context,
				visibleActions: actions,
			}).score,
	);
}

export function chooseComputerTurn(
	computer: ComputerPlayer,
	visibleQuestionCards: readonly QuestionCard[],
	random = Math.random,
	context: OpponentContext = {},
) {
	const guess = shouldGuess(computer.candidates, computer.difficulty, context);
	if (guess) return { type: "guess", code: guess } as const;

	const action = chooseQuestionAction(
		computer,
		visibleQuestionCards,
		random,
		context,
	);
	if (!action) return { type: "pass" } as const;

	return { type: "ask", action } as const;
}
