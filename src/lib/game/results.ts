import type { DifficultyName, GameState, GameStatus } from "./types";

const RESULT_STORAGE_KEY = "break-the-code:results:v1";

export type StoredGameResult = {
	id: string;
	finishedAt: string;
	difficulty: DifficultyName;
	status: Exclude<GameStatus, "playing">;
	winner: "human" | "computer" | "none";
	turnNumber: number;
	candidatesRemaining: number;
};

function parseResults(value: string | null) {
	if (!value) {
		return [];
	}

	try {
		const parsed = JSON.parse(value);
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter(
			(item): item is StoredGameResult =>
				typeof item?.id === "string" &&
				typeof item?.finishedAt === "string" &&
				typeof item?.difficulty === "string" &&
				typeof item?.status === "string" &&
				typeof item?.winner === "string" &&
				typeof item?.turnNumber === "number" &&
				typeof item?.candidatesRemaining === "number",
		);
	} catch {
		return [];
	}
}

export function loadStoredResults(storage: Storage) {
	return parseResults(storage.getItem(RESULT_STORAGE_KEY));
}

export function createStoredResult(state: GameState): StoredGameResult | null {
	if (state.status === "playing") {
		return null;
	}

	const winner =
		state.status === "human-won"
			? "human"
			: state.status === "computer-won"
				? "computer"
				: "none";

	return {
		id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
		finishedAt: new Date().toISOString(),
		difficulty: state.computer.difficulty.name,
		status: state.status,
		winner,
		turnNumber: state.turnNumber,
		candidatesRemaining: state.computer.candidates.length,
	};
}

export function saveStoredResult(storage: Storage, result: StoredGameResult) {
	const next = [result, ...loadStoredResults(storage)].slice(0, 20);
	storage.setItem(RESULT_STORAGE_KEY, JSON.stringify(next));
	return next;
}

export function clearStoredResults(storage: Storage) {
	storage.removeItem(RESULT_STORAGE_KEY);
}
