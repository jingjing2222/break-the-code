import { colorLabels, formatTile, visibleTileKey } from "./tiles";
import type { Code, QuestionAction, QuestionCard } from "./types";

const positions = ["A", "B", "C", "D", "E"] as const;
const positionLabels = {
	A: "A칸",
	B: "B칸",
	C: "C칸",
	D: "D칸",
	E: "E칸",
} as const;

function positionList(indexes: number[]) {
	return indexes.length === 0
		? "없음"
		: indexes.map((index) => positionLabels[positions[index]]).join(", ");
}

function getNumberParam(action: QuestionAction) {
	if (typeof action.param !== "number") return 0;
	return action.param;
}

function getStringParam(action: QuestionAction) {
	if (typeof action.param !== "string") return "";
	return action.param;
}

function count(
	code: Code,
	predicate: (tile: Code[number], index: number) => boolean,
) {
	return code.filter(predicate).length;
}

function groupsFromAdjacent(
	code: Code,
	predicate: (left: Code[number], right: Code[number]) => boolean,
) {
	const groups: number[][] = [];
	let current: number[] = [];

	for (let index = 0; index < code.length - 1; index += 1) {
		if (predicate(code[index], code[index + 1])) {
			if (current.length === 0) current = [index];
			current.push(index + 1);
		} else if (current.length > 0) {
			groups.push(current);
			current = [];
		}
	}

	if (current.length > 0) groups.push(current);

	return groups.length === 0
		? "없음"
		: groups
				.map((group) => group.map((index) => positions[index]).join(""))
				.join(" / ");
}

export const QUESTION_CARDS = [
	{
		id: "count-odd",
		title: "홀수 개수",
		prompt: "홀수 타일은 몇 개입니까?",
		isSharedInfo: false,
		answer: (_action, code) => count(code, (tile) => tile.number % 2 === 1),
	},
	{
		id: "count-even",
		title: "짝수 개수",
		prompt: "짝수 타일은 몇 개입니까?",
		isSharedInfo: false,
		answer: (_action, code) => count(code, (tile) => tile.number % 2 === 0),
	},
	{
		id: "count-low",
		title: "낮은 숫자",
		prompt: "0~4 타일은 몇 개입니까?",
		isSharedInfo: false,
		answer: (_action, code) => count(code, (tile) => tile.number <= 4),
	},
	{
		id: "count-high",
		title: "높은 숫자",
		prompt: "5~9 타일은 몇 개입니까?",
		isSharedInfo: false,
		answer: (_action, code) => count(code, (tile) => tile.number >= 5),
	},
	{
		id: "count-color",
		title: "색상 개수",
		prompt: "선택한 색 타일은 몇 개입니까?",
		isSharedInfo: false,
		params: ["R", "B", "G"],
		answer: (action, code) =>
			count(code, (tile) => tile.color === getStringParam(action)),
	},
	{
		id: "sum-left-two",
		title: "왼쪽 두 칸 합",
		prompt: "A+B의 숫자 합은 얼마입니까?",
		isSharedInfo: false,
		answer: (_action, code) => code[0].number + code[1].number,
	},
	{
		id: "sum-left-three",
		title: "왼쪽 세 칸 합",
		prompt: "A+B+C의 숫자 합은 얼마입니까?",
		isSharedInfo: false,
		answer: (_action, code) => code[0].number + code[1].number + code[2].number,
	},
	{
		id: "sum-right-three",
		title: "오른쪽 세 칸 합",
		prompt: "C+D+E의 숫자 합은 얼마입니까?",
		isSharedInfo: false,
		answer: (_action, code) => code[2].number + code[3].number + code[4].number,
	},
	{
		id: "diff-max-min",
		title: "최댓값 차이",
		prompt: "가장 큰 숫자와 가장 작은 숫자의 차이는 얼마입니까?",
		isSharedInfo: false,
		answer: (_action, code) => code[4].number - code[0].number,
	},
	{
		id: "where-number",
		title: "숫자 위치",
		prompt: "선택한 숫자는 어디에 있습니까?",
		isSharedInfo: false,
		params: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
		answer: (action, code) => {
			const target = getNumberParam(action);
			return positionList(
				code
					.map((tile, index) => (tile.number === target ? index : -1))
					.filter((index) => index >= 0),
			);
		},
	},
	{
		id: "where-color",
		title: "색상 위치",
		prompt: "선택한 색은 어디에 있습니까?",
		isSharedInfo: false,
		params: ["R", "B", "G"],
		answer: (action, code) => {
			const target = getStringParam(action);
			return positionList(
				code
					.map((tile, index) => (tile.color === target ? index : -1))
					.filter((index) => index >= 0),
			);
		},
	},
	{
		id: "center-tile-color",
		title: "가운데 색",
		prompt: "C 타일의 색은 무엇입니까?",
		isSharedInfo: false,
		answer: (_action, code) => colorLabels[code[2].color],
	},
	{
		id: "center-tile-number",
		title: "가운데 숫자",
		prompt: "C 타일의 숫자는 무엇입니까?",
		isSharedInfo: false,
		answer: (_action, code) => code[2].number,
	},
	{
		id: "leftmost-color",
		title: "맨 왼쪽 색",
		prompt: "A 타일의 색은 무엇입니까?",
		isSharedInfo: false,
		answer: (_action, code) => colorLabels[code[0].color],
	},
	{
		id: "rightmost-color",
		title: "맨 오른쪽 색",
		prompt: "E 타일의 색은 무엇입니까?",
		isSharedInfo: false,
		answer: (_action, code) => colorLabels[code[4].color],
	},
	{
		id: "adjacent-same-color",
		title: "이웃한 같은 색",
		prompt: "같은 색으로 붙어 있는 이웃 타일은 어디입니까?",
		isSharedInfo: true,
		answer: (_action, code) =>
			groupsFromAdjacent(code, (left, right) => left.color === right.color),
	},
	{
		id: "adjacent-consecutive",
		title: "이웃한 연속 숫자",
		prompt: "연속 숫자로 붙어 있는 이웃 타일은 어디입니까?",
		isSharedInfo: true,
		answer: (_action, code) =>
			groupsFromAdjacent(
				code,
				(left, right) => right.number - left.number === 1,
			),
	},
	{
		id: "same-number-pairs",
		title: "같은 숫자 쌍",
		prompt: "같은 숫자 타일 쌍은 어디입니까?",
		isSharedInfo: true,
		answer: (_action, code) =>
			groupsFromAdjacent(code, (left, right) => left.number === right.number),
	},
	{
		id: "has-number",
		title: "숫자 보유",
		prompt: "선택한 숫자를 가지고 있습니까?",
		isSharedInfo: false,
		params: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
		answer: (action, code) =>
			code.some((tile) => tile.number === getNumberParam(action)),
	},
	{
		id: "count-greater-than",
		title: "초과 개수",
		prompt: "선택한 숫자보다 큰 타일은 몇 개입니까?",
		isSharedInfo: false,
		params: [2, 3, 4, 5, 6, 7],
		answer: (action, code) =>
			count(code, (tile) => tile.number > getNumberParam(action)),
	},
	{
		id: "visible-key-at-position",
		title: "지정 칸 공개",
		prompt: "선택한 위치의 색과 숫자는 무엇입니까?",
		isSharedInfo: true,
		params: [0, 1, 2, 3, 4],
		answer: (action, code) => {
			const index = getNumberParam(action);
			return `${positions[index]}=${visibleTileKey(code[index])}`;
		},
	},
] satisfies QuestionCard[];

export function generateLegalQuestionActions(
	cards: readonly QuestionCard[],
): QuestionAction[] {
	return cards.flatMap((card) => {
		if (!card.params) {
			return [{ cardId: card.id, isSharedInfo: card.isSharedInfo }];
		}

		return card.params.map((param) => ({
			cardId: card.id,
			param,
			isSharedInfo: card.isSharedInfo,
		}));
	});
}

export function getQuestionCard(cardId: string, cards = QUESTION_CARDS) {
	const card = cards.find((item) => item.id === cardId);
	if (!card) throw new Error(`Unknown question card: ${cardId}`);
	return card;
}

export function answerQuestion(
	action: QuestionAction,
	code: Code,
	cards = QUESTION_CARDS,
) {
	return getQuestionCard(action.cardId, cards).answer(action, code);
}

export function formatAction(action: QuestionAction, cards = QUESTION_CARDS) {
	const card = getQuestionCard(action.cardId, cards);
	const suffix =
		action.param === undefined
			? ""
			: typeof action.param === "number"
				? ` (${card.id === "visible-key-at-position" ? positions[action.param] : action.param})`
				: ` (${colorLabels[action.param as keyof typeof colorLabels] ?? action.param})`;

	return `${card.title}${suffix}`;
}

export function formatAnswerForLog(answer: unknown) {
	const value = String(answer);
	const visibleTile = value.match(/^([A-E])=([RBG])(\d)$/);
	if (visibleTile) {
		const [, position, color, number] = visibleTile;
		return `${positionLabels[position as keyof typeof positionLabels]} ${formatTile(
			{
				id: `${color}${number}`,
				color: color as keyof typeof colorLabels,
				number: Number(number),
			},
		)}`;
	}

	if (value === "true") return "예";
	if (value === "false") return "아니요";
	return value;
}

export function formatQuestionForLog(
	action: QuestionAction,
	actor: "human" | "computer",
) {
	const owner = actor === "human" ? "컴퓨터 암호" : "내 암호";
	const param = action.param;

	switch (action.cardId) {
		case "visible-key-at-position": {
			const position =
				typeof param === "number"
					? positionLabels[positions[param]]
					: "선택한 칸";
			return `${owner}의 ${position}을 공개하라고 물었습니다.`;
		}
		case "where-number":
			return `${owner}에서 숫자 ${param}이 있는 칸을 물었습니다.`;
		case "where-color":
		case "count-color":
			return `${owner}에서 ${colorLabels[param as keyof typeof colorLabels]} 타일을 물었습니다.`;
		case "has-number":
			return `${owner}에 숫자 ${param}이 있는지 물었습니다.`;
		case "count-greater-than":
			return `${owner}에서 ${param}보다 큰 타일 개수를 물었습니다.`;
		default:
			return `${owner}에 대해 "${formatAction(action)}" 질문을 했습니다.`;
	}
}
