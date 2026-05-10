import { answerQuestion } from "./questions";
import { sortCode, visibleCodeKey } from "./tiles";
import type { Answer, Code, QuestionAction, Tile } from "./types";

export function combinations<T>(items: readonly T[], size: number): T[][] {
	if (size === 0) return [[]] as T[][];
	if (items.length < size) return [] as T[][];

	const [head, ...tail] = items;

	return [
		...combinations(tail, size - 1).map((combination) => [
			head,
			...combination,
		]),
		...combinations(tail, size),
	];
}

export function makeInitialCandidates(
	deck: readonly Tile[],
	myTiles: readonly Tile[],
) {
	const myIds = new Set(myTiles.map((tile) => tile.id));
	const available = deck.filter((tile) => !myIds.has(tile.id));

	return combinations(available, 5).map(sortCode);
}

export function answerKey(answer: Answer) {
	return String(answer);
}

export function filterCandidates(
	candidates: readonly Code[],
	action: QuestionAction,
	observedAnswer: Answer,
) {
	const observed = answerKey(observedAnswer);
	return candidates.filter(
		(code) => answerKey(answerQuestion(action, code)) === observed,
	);
}

export function bucketCandidates(
	candidates: readonly Code[],
	action: QuestionAction,
) {
	const buckets = new Map<string, Code[]>();

	for (const code of candidates) {
		const answer = answerKey(answerQuestion(action, code));
		const bucket = buckets.get(answer);

		if (bucket) {
			bucket.push(code);
		} else {
			buckets.set(answer, [code]);
		}
	}

	return buckets;
}

export function expectedRemaining(
	candidates: readonly Code[],
	action: QuestionAction,
) {
	const buckets = bucketCandidates(candidates, action);
	const total = candidates.length;
	let expected = 0;

	for (const bucket of buckets.values()) {
		const probability = bucket.length / total;
		expected += probability * bucket.length;
	}

	return expected;
}

export function worstCaseRemaining(
	candidates: readonly Code[],
	action: QuestionAction,
) {
	const sizes = [...bucketCandidates(candidates, action).values()].map(
		(bucket) => bucket.length,
	);
	return Math.max(...sizes);
}

export function distinctAnswerCount(
	candidates: readonly Code[],
	action: QuestionAction,
) {
	return bucketCandidates(candidates, action).size;
}

export function getVisibleCandidateGroups(candidates: readonly Code[]) {
	const groups = new Map<string, Code[]>();

	for (const code of candidates) {
		const key = visibleCodeKey(code);
		const group = groups.get(key);

		if (group) {
			group.push(code);
		} else {
			groups.set(key, [code]);
		}
	}

	return groups;
}
