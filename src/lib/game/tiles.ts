import type { Code, Color, Tile } from "./types";

export const colorRank = {
	R: 0,
	B: 1,
	G: 2,
} satisfies Record<Color, number>;

export const colorLabels = {
	R: "빨강",
	B: "파랑",
	G: "초록",
} satisfies Record<Color, string>;

export function createDeck() {
	const normalNumbers = [0, 1, 2, 3, 4, 6, 7, 8, 9];

	return [
		...normalNumbers.flatMap((number) => [
			{ id: `R${number}`, number, color: "R" as const },
			{ id: `B${number}`, number, color: "B" as const },
		]),
		{ id: "G5a", number: 5, color: "G" as const },
		{ id: "G5b", number: 5, color: "G" as const },
	] satisfies Tile[];
}

export function sortCode(code: Tile[]): Code {
	return [...code].sort((a, b) => {
		if (a.number !== b.number) return a.number - b.number;
		return colorRank[a.color] - colorRank[b.color];
	});
}

export function visibleTileKey(tile: Tile) {
	return `${tile.color}${tile.number}`;
}

export function visibleCodeKey(code: Code) {
	return code.map(visibleTileKey).join("-");
}

export function formatTile(tile: Tile) {
	return `${colorLabels[tile.color]} ${tile.number}`;
}

export function formatCode(code: Code) {
	return code.map(formatTile).join(" / ");
}

export function createSeededRandom(seed: number) {
	let value = seed % 2147483647;
	if (value <= 0) value += 2147483646;

	return () => {
		value = (value * 16807) % 2147483647;
		return (value - 1) / 2147483646;
	};
}

export function shuffleTiles<T>(items: readonly T[], random = Math.random) {
	const next = [...items];

	for (let index = next.length - 1; index > 0; index -= 1) {
		const target = Math.floor(random() * (index + 1));
		const current = next[index];
		next[index] = next[target];
		next[target] = current;
	}

	return next;
}

export function dealCodes(deck: readonly Tile[], random = Math.random) {
	const shuffled = shuffleTiles(deck, random);
	const humanCode = sortCode(shuffled.slice(0, 5));
	const computerCode = sortCode(shuffled.slice(5, 10));

	return { humanCode, computerCode };
}
