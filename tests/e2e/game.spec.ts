import { expect, test } from "@playwright/test";
import {
	createGame,
	createSeededRandom,
	visibleCodeKey,
} from "../../src/lib/game";

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

	await page.getByRole("button", { name: "추측 제출" }).click();
	await expect(page.getByLabel("게임 기록")).toContainText("오답입니다.");

	await page.getByRole("button", { name: "새 게임" }).click();

	for (let index = 0; index < expected.length; index += 1) {
		const slot = String.fromCharCode(65 + index);
		await page
			.getByLabel(
				`${slot} ${expected[index].color === "R" ? "빨강" : expected[index].color === "B" ? "파랑" : "초록"} 선택`,
			)
			.click();
		await page
			.getByLabel(`${index + 1}번 숫자`)
			.fill(String(expected[index].number));
	}

	await page.getByRole("button", { name: "추측 제출" }).click();
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
