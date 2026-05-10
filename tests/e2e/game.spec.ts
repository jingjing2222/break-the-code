import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { createGame } from "../../src/lib/game/engine";
import { createSeededRandom, visibleCodeKey } from "../../src/lib/game/tiles";
import type { Tile } from "../../src/lib/game/types";

function colorLabel(color: Tile["color"]) {
	if (color === "R") return "빨강";
	if (color === "B") return "파랑";
	return "초록";
}

async function fillGuess(page: Page, code: readonly Tile[]) {
	await code.reduce(async (previous, tile, index) => {
		await previous;

		const slot = String.fromCharCode(65 + index);
		await page.getByLabel(`${slot} ${colorLabel(tile.color)} 선택`).click();
		await page.getByLabel(`${index + 1}번 숫자`).fill(String(tile.number));
	}, Promise.resolve());
}

test("mobile flow starts a game, asks a question, and receives an AI turn", async ({
	page,
}) => {
	await page.goto("/game?seed=31&difficulty=beginner&first=human");

	await expect(
		page.getByRole("heading", { name: "Break the Code" }),
	).toBeVisible();
	await expect(page.getByLabel("컴퓨터 암호").getByText("?")).toHaveCount(5);
	await expect(page.getByLabel("질문 카드").getByRole("article")).toHaveCount(
		6,
	);

	await page
		.getByLabel("질문 카드")
		.getByRole("button", { exact: true, name: "선택" })
		.first()
		.click();
	await page.getByRole("button", { name: "질문하기" }).click();

	await expect(page.getByText(/컴퓨터가|컴퓨터 추측/)).toBeVisible();
	await expect(page.getByLabel("게임 기록")).toContainText("답:");
	await expect(page.getByLabel("내 질문")).toBeVisible();
	await expect(page.getByLabel("컴퓨터 질문")).toBeVisible();

	const questionInfoToggle = page
		.getByRole("button", { name: /질문 설명 토글/ })
		.first();
	await expect(questionInfoToggle).toHaveAttribute("aria-expanded", "false");
	await questionInfoToggle.click();
	await expect(questionInfoToggle).toHaveAttribute("aria-expanded", "true");
	await expect(page.getByRole("tooltip")).toBeVisible();
});

test("desktop layout exposes board, question cards, and deduction log", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1366, height: 900 });
	await page.goto("/game?seed=41&difficulty=expert&first=human");

	await expect(page.getByLabel("컴퓨터 암호")).toBeVisible();
	await expect(page.getByLabel("내 암호")).toBeVisible();
	await expect(page.getByLabel("질문 카드")).toBeVisible();
	await expect(page.getByLabel("게임 기록")).toContainText("전문가 컴퓨터");
	await expect(page.getByRole("button", { name: "메모장 열기" })).toBeVisible();
});

test("sticky memo opens as an overlay and keeps local notes", async ({
	page,
}) => {
	await page.goto("/game?seed=61&difficulty=intermediate&first=human");

	await page.getByRole("button", { name: "메모장 열기" }).click();
	await expect(page.getByRole("dialog", { name: "메모장" })).toBeVisible();

	await page.getByLabel("게임 메모").fill("B는 파랑 후보, 7 확인 필요");
	await page.getByRole("button", { name: "메모장 닫기" }).first().click();
	await expect(page.getByRole("dialog", { name: "메모장" })).toHaveCount(0);

	await page.getByRole("button", { name: "메모장 열기" }).click();
	await expect(page.getByLabel("게임 메모")).toHaveValue(
		"B는 파랑 후보, 7 확인 필요",
	);
	await page.getByRole("button", { name: "메모장 닫기" }).first().click();
	await expect(page.getByRole("dialog", { name: "메모장" })).toHaveCount(0);
});

test("wrong and correct guesses complete the human guess flow", async ({
	page,
}) => {
	const seed = 53;
	const expected = createGame(
		"intermediate",
		createSeededRandom(seed),
	).computerCode;

	await page.goto(`/game?seed=${seed}&difficulty=intermediate&first=human`);

	await expect(page.getByRole("button", { name: "추측 제출" })).toBeDisabled();
	await page.getByLabel("A 빨강 선택").click();
	await expect(page.getByLabel("A 빨강 선택")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await page.getByLabel("A 빨강 선택").click();
	await expect(page.getByLabel("A 빨강 선택")).toHaveAttribute(
		"aria-pressed",
		"false",
	);

	const wrong = expected.map((tile, index) =>
		index === 0 ? { ...tile, number: (tile.number + 1) % 10 } : tile,
	);
	await fillGuess(page, wrong);

	await expect(page.getByRole("button", { name: "추측 제출" })).toBeEnabled();
	await page.getByRole("button", { name: "추측 제출" }).click();
	await expect(page.getByLabel("게임 기록")).toContainText("오답입니다.");

	await page.getByRole("button", { name: "새 게임" }).click();
	await expect(page.getByRole("button", { name: "추측 제출" })).toBeDisabled();

	await fillGuess(page, expected);

	await expect(page.getByRole("button", { name: "추측 제출" })).toBeEnabled();
	await page.getByRole("button", { name: "추측 제출" }).click();
	await expect(page.getByRole("dialog", { name: "게임 결과" })).toContainText(
		"승리",
	);
	await page.mouse.click(8, 8);
	await expect(page.getByRole("dialog", { name: "게임 결과" })).toHaveCount(0);
	await expect(page.getByText("플레이어가 암호를 해독했습니다.")).toBeVisible();
	await page.waitForFunction(() =>
		window.localStorage
			.getItem("break-the-code:results:v1")
			?.includes("human-won"),
	);
	await page.getByRole("link", { name: "전적" }).click();
	await expect(page.getByLabel("저장된 전적")).toContainText("승리");
	await expect(visibleCodeKey(expected)).toContain("-");
});
