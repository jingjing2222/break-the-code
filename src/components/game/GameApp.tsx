import {
	Brain,
	Check,
	HelpCircle,
	RotateCcw,
	Send,
	ShieldQuestion,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	askQuestion,
	type Code,
	type Color,
	colorLabels,
	createGame,
	createSeededRandom,
	DIFFICULTIES,
	type DifficultyName,
	formatAction,
	formatCode,
	type GameState,
	getLegalActionsForCard,
	guessCode,
	type Player,
	type QuestionAction,
	runComputerTurn,
	sortCode,
} from "#/lib/game";
import { createStoredResult, saveStoredResult } from "#/lib/game/results";

const colorOptions = ["R", "B", "G"] as const;
const guessSlots = ["A", "B", "C", "D", "E"] as const;

const ribbonClass =
	"inline-flex min-h-8 items-center bg-black px-3 font-['Space_Mono'] text-xs font-bold uppercase tracking-[1.2px] text-white";
const outlineButtonClass =
	"inline-flex min-h-11 items-center justify-center gap-2 border-2 border-black bg-white px-4 py-2 font-['Work_Sans'] font-bold uppercase text-black hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-50";

function getInitialDifficulty() {
	if (typeof window === "undefined") return "intermediate";
	const difficulty = new URLSearchParams(window.location.search).get(
		"difficulty",
	);
	return difficulty && difficulty in DIFFICULTIES
		? (difficulty as DifficultyName)
		: "intermediate";
}

function getInitialSeed() {
	if (typeof window === "undefined") return undefined;
	const raw = new URLSearchParams(window.location.search).get("seed");
	if (!raw) return undefined;
	const seed = Number(raw);
	return Number.isFinite(seed) ? seed : undefined;
}

function getInitialStartingPlayer() {
	if (typeof window === "undefined") return undefined;
	const first = new URLSearchParams(window.location.search).get("first");
	return first === "human" || first === "computer" ? first : undefined;
}

function createInitialGame(
	difficulty: DifficultyName,
	seed?: number,
	startingPlayer?: Player,
) {
	return createGame(
		difficulty,
		seed === undefined ? Math.random : createSeededRandom(seed),
		startingPlayer,
	);
}

function makeGuessCode(
	colors: readonly Color[],
	numbers: readonly number[],
): Code {
	return sortCode(
		colors.map((color, index) => ({
			id: `guess-${index}-${color}${numbers[index]}`,
			color,
			number: numbers[index],
		})),
	);
}

function statusText(state: GameState) {
	if (state.status === "human-won") return "플레이어가 암호를 해독했습니다.";
	if (state.status === "computer-won") return "컴퓨터가 먼저 해독했습니다.";
	if (state.status === "tie") return "동점입니다.";
	if (state.status === "exhausted") return "질문 카드가 모두 소진되었습니다.";
	return state.turn === "human" ? "플레이어 차례" : "컴퓨터 차례";
}

function actorLabel(actor: Player) {
	return actor === "human" ? "나" : "컴퓨터";
}

function logKindLabel(kind: GameState["log"][number]["kind"]) {
	if (kind === "ask") return "질문";
	if (kind === "guess") return "정답 선언";
	return "안내";
}

function tileColorClass(color: Color) {
	if (color === "R") return "border-t-[#c62828]";
	if (color === "B") return "border-t-[#1264a3]";
	return "border-t-[#22863a]";
}

function colorSwatchClass(color: Color, selected: boolean) {
	const colorClass =
		color === "R"
			? "border-[#c62828] text-[#c62828]"
			: color === "B"
				? "border-[#1264a3] text-[#1264a3]"
				: "border-[#22863a] text-[#22863a]";

	return `min-h-10 border-2 px-2 font-['Work_Sans'] text-xs font-bold ${
		selected ? `${colorClass} bg-black text-white` : `${colorClass} bg-white`
	}`;
}

function TileRack({
	code,
	hidden,
	label,
}: {
	code: Code;
	hidden?: boolean;
	label: string;
}) {
	return (
		<section className="border-t-2 border-black" aria-label={label}>
			<div className={ribbonClass}>{label}</div>
			<div className="grid grid-cols-5 border-r border-b border-black">
				{code.map((tile, index) => (
					<div
						className={`grid min-h-[82px] place-items-center border-t-[5px] border-l border-black bg-white text-center lg:min-h-[100px] ${
							hidden
								? "border-t-black bg-[repeating-linear-gradient(45deg,#fff,#fff_8px,#f1f1f1_8px,#f1f1f1_16px)]"
								: tileColorClass(tile.color)
						}`}
						key={tile.id}
					>
						<span className="font-['Space_Mono'] text-[10px] uppercase tracking-[0.8px] text-[#757575]">
							{String.fromCharCode(65 + index)}
						</span>
						<strong className="font-['Libre_Baskerville'] text-3xl leading-none">
							{hidden ? "?" : tile.number}
						</strong>
						<span className="font-['Space_Mono'] text-[10px] uppercase tracking-[0.8px]">
							{hidden ? "숨김" : colorLabels[tile.color]}
						</span>
					</div>
				))}
			</div>
		</section>
	);
}

function QuestionPanel({
	state,
	selectedAction,
	onSelectAction,
	onAsk,
}: {
	state: GameState;
	selectedAction: QuestionAction | null;
	onSelectAction: (action: QuestionAction) => void;
	onAsk: () => void;
}) {
	return (
		<section className="border-t-2 border-black" aria-label="질문 카드">
			<div className={ribbonClass}>공개 질문 카드 6장</div>
			<div className="mt-3 grid gap-3 md:grid-cols-2">
				{state.visibleQuestionCards.map((card) => {
					const actions = getLegalActionsForCard(state, card.id);

					return (
						<article className="border border-black p-3" key={card.id}>
							<div className="flex items-center justify-between gap-2">
								<p className="m-0 font-['Work_Sans'] text-xs font-bold">
									{card.isSharedInfo ? "함께 공개" : "질문"}
								</p>
								{card.isSharedInfo && (
									<HelpCircle aria-hidden="true" size={16} />
								)}
							</div>
							<h3 className="mt-2 font-['Work_Sans'] text-base font-bold">
								{card.title}
							</h3>
							<p className="mt-1 leading-6">{card.prompt}</p>
							<div className="mt-3 flex flex-wrap gap-2">
								{actions.map((action) => {
									const actionKey = `${action.cardId}-${action.param ?? "default"}`;
									const selected =
										selectedAction?.cardId === action.cardId &&
										selectedAction.param === action.param;

									return (
										<button
											aria-pressed={selected}
											className={`min-h-9 border border-black px-2 py-1 font-['Work_Sans'] text-xs ${
												selected
													? "bg-black text-white"
													: "bg-white text-black hover:bg-black hover:text-white"
											}`}
											key={actionKey}
											onClick={() => onSelectAction(action)}
											type="button"
										>
											{action.param === undefined
												? "선택"
												: formatAction(action)}
										</button>
									);
								})}
							</div>
						</article>
					);
				})}
			</div>
			<button
				className={`mt-3 w-full ${outlineButtonClass}`}
				disabled={
					!selectedAction ||
					state.turn !== "human" ||
					state.status !== "playing"
				}
				onClick={onAsk}
				type="button"
			>
				<Send aria-hidden="true" size={18} />
				질문하기
			</button>
		</section>
	);
}

function GuessPanel({
	colors,
	numbers,
	onColorChange,
	onNumberChange,
	onGuess,
	disabled,
}: {
	colors: readonly Color[];
	numbers: readonly number[];
	onColorChange: (index: number, color: Color) => void;
	onNumberChange: (index: number, number: number) => void;
	onGuess: () => void;
	disabled: boolean;
}) {
	return (
		<section className="border-t-2 border-black" aria-label="정답 추측">
			<div className={ribbonClass}>정답 선언</div>
			<div className="mt-3 grid gap-2">
				{guessSlots.map((slot, index) => {
					const color = colors[index];

					return (
						<div
							className="grid grid-cols-[28px_1fr_54px] items-center gap-2"
							key={slot}
						>
							<span className="font-['Space_Mono'] text-xs font-bold">
								{slot}
							</span>
							<fieldset className="grid grid-cols-3 gap-1">
								<legend className="sr-only">{slot} 색상</legend>
								{colorOptions.map((option) => (
									<button
										aria-label={`${slot} ${colorLabels[option]} 선택`}
										aria-pressed={color === option}
										className={colorSwatchClass(option, color === option)}
										key={option}
										onClick={() => onColorChange(index, option)}
										type="button"
									>
										{colorLabels[option]}
									</button>
								))}
							</fieldset>
							<input
								aria-label={`${index + 1}번 숫자`}
								className="min-h-10 border-2 border-black bg-white px-2 text-center font-['Libre_Baskerville'] text-2xl font-bold text-black"
								inputMode="numeric"
								maxLength={1}
								onChange={(event) => {
									const digit = event.target.value.replace(/\D/g, "").slice(-1);
									onNumberChange(index, digit === "" ? 0 : Number(digit));
								}}
								pattern="[0-9]"
								value={numbers[index]}
							/>
						</div>
					);
				})}
			</div>
			<button
				className={`mt-3 w-full ${outlineButtonClass}`}
				disabled={disabled}
				onClick={onGuess}
				type="button"
			>
				<Check aria-hidden="true" size={18} />
				추측 제출
			</button>
		</section>
	);
}

function LogPanel({ state }: { state: GameState }) {
	const latest = state.log[0];
	const previous = state.log.slice(1, 6);

	return (
		<section className="border-t-2 border-black" aria-label="게임 기록">
			<div className={ribbonClass}>게임 기록</div>
			<div className="mt-3 border-2 border-black p-3">
				<div className="flex items-start gap-3">
					<Brain aria-hidden="true" size={22} />
					<div>
						<p className="m-0 font-['Work_Sans'] text-lg font-bold">
							{state.computer.difficulty.label} 컴퓨터
						</p>
						<p className="m-0 mt-1 text-sm leading-6 text-[#555]">
							남은 질문 {state.questionDeck.length}장 / {state.turnNumber}번째
							차례
						</p>
					</div>
				</div>
			</div>
			{latest && (
				<article className="mt-3 border-2 border-black p-3">
					<div className="flex items-center justify-between gap-3">
						<span className="font-['Work_Sans'] text-xs font-bold">
							최근 기록 / {actorLabel(latest.actor)}
						</span>
						<span className="border border-black px-2 py-1 font-['Work_Sans'] text-xs font-bold">
							{logKindLabel(latest.kind)}
						</span>
					</div>
					<p className="mt-3 text-lg leading-7">{latest.text}</p>
					{latest.answer !== undefined && (
						<strong className="mt-2 inline-flex bg-black px-3 py-1 font-['Work_Sans'] text-white">
							답: {String(latest.answer)}
						</strong>
					)}
				</article>
			)}
			<ul className="mt-3 grid list-none gap-2 p-0">
				{previous.length === 0 ? (
					<li className="border border-black p-3 text-sm leading-6 text-[#555]">
						질문하거나 정답을 선언하면 기록이 여기에 쌓입니다.
					</li>
				) : (
					previous.map((entry) => (
						<li className="border-b border-black pb-2" key={entry.id}>
							<span className="font-['Work_Sans'] text-xs font-bold text-[#555]">
								{actorLabel(entry.actor)} / {logKindLabel(entry.kind)}
							</span>
							<p className="mt-1 leading-6">{entry.text}</p>
							{entry.answer !== undefined && (
								<span className="mt-1 inline-flex border border-black px-2 py-1 font-['Space_Mono'] text-[11px] uppercase tracking-[1px]">
									답: {String(entry.answer)}
								</span>
							)}
						</li>
					))
				)}
			</ul>
		</section>
	);
}

export default function GameApp() {
	const [difficulty, setDifficulty] = useState<DifficultyName>("intermediate");
	const [seed, setSeed] = useState<number | undefined>();
	const [startingPlayer, setStartingPlayer] = useState<Player | undefined>();
	const [state, setState] = useState<GameState | null>(null);
	const [selectedAction, setSelectedAction] = useState<QuestionAction | null>(
		null,
	);
	const [savedResultKey, setSavedResultKey] = useState<string | null>(null);
	const [guessColors, setGuessColors] = useState<readonly Color[]>([
		"R",
		"R",
		"R",
		"R",
		"R",
	]);
	const [guessNumbers, setGuessNumbers] = useState<readonly number[]>([
		0, 1, 2, 3, 4,
	]);

	const currentGuess = useMemo(
		() => makeGuessCode(guessColors, guessNumbers),
		[guessColors, guessNumbers],
	);

	useEffect(() => {
		const initialDifficulty = getInitialDifficulty();
		const initialSeed = getInitialSeed();
		const initialStartingPlayer = getInitialStartingPlayer();

		setDifficulty(initialDifficulty);
		setSeed(initialSeed);
		setStartingPlayer(initialStartingPlayer);
		setState(
			createInitialGame(initialDifficulty, initialSeed, initialStartingPlayer),
		);
	}, []);

	useEffect(() => {
		if (!state) return;
		if (state.turn !== "computer" || state.status !== "playing") return;

		const timer = window.setTimeout(() => {
			setState((current) => (current ? runComputerTurn(current) : current));
		}, 450);

		return () => window.clearTimeout(timer);
	}, [state]);

	useEffect(() => {
		if (!state || state.status === "playing") return;

		const resultKey = `${state.status}-${state.turnNumber}-${state.log[0]?.id}`;
		if (savedResultKey === resultKey) return;

		const result = createStoredResult(state);
		if (!result) return;

		saveStoredResult(window.localStorage, result);
		setSavedResultKey(resultKey);
	}, [savedResultKey, state]);

	function restart(nextDifficulty = difficulty) {
		setDifficulty(nextDifficulty);
		setSelectedAction(null);
		setSavedResultKey(null);
		setState(createInitialGame(nextDifficulty, seed, startingPlayer));
	}

	function handleAsk() {
		if (!selectedAction) return;
		setState((current) =>
			current ? askQuestion(current, "human", selectedAction) : current,
		);
		setSelectedAction(null);
	}

	function handleGuess() {
		setState((current) =>
			current ? guessCode(current, "human", currentGuess) : current,
		);
	}

	if (!state) {
		return (
			<main className="mx-auto max-w-[1600px] px-4 py-4 md:px-6">
				<section
					className="my-4 flex min-h-11 items-center justify-between gap-4 bg-black px-3 font-['Space_Mono'] text-xs uppercase tracking-[1px] text-white"
					aria-live="polite"
				>
					<span>게임 준비 중</span>
					<strong>준비 중</strong>
				</section>
			</main>
		);
	}

	const disabled = state.turn !== "human" || state.status !== "playing";

	return (
		<main className="mx-auto max-w-[1600px] px-4 py-4 text-[#1a1a1a] md:px-6">
			<section
				className="grid gap-5 border-b-2 border-black py-5 md:grid-cols-[minmax(0,1fr)_260px] md:items-end"
				aria-labelledby="game-title"
			>
				<div>
					<p className="m-0 font-['Space_Mono'] text-xs font-bold uppercase tracking-[1.2px]">
						TAGIRON / BREAK THE CODE
					</p>
					<h1
						className="m-0 mt-2 font-['Libre_Baskerville'] text-[clamp(2.4rem,11vw,5.5rem)] leading-[1.05] tracking-normal text-black"
						id="game-title"
					>
						Break the Code
					</h1>
					<p className="mt-3 max-w-3xl text-base leading-7">
						공개 질문 카드 6장을 골라 컴퓨터의 5개 암호 타일을 먼저 맞히십시오.
						난이도가 높을수록 컴퓨터는 더 신중하게 질문하고 확실할 때 정답을
						선언합니다.
					</p>
				</div>
				<fieldset className="grid content-start gap-2">
					<legend className="font-['Space_Mono'] text-xs font-bold uppercase tracking-[1px]">
						게임 설정
					</legend>
					<label className="grid gap-1 font-['Space_Mono'] text-xs font-bold uppercase tracking-[1px]">
						난이도
						<select
							className="min-h-11 border-2 border-black bg-white px-3 py-2 font-['Work_Sans'] text-base font-bold text-black"
							onChange={(event) =>
								restart(event.target.value as DifficultyName)
							}
							value={difficulty}
						>
							{Object.values(DIFFICULTIES).map((item) => (
								<option key={item.name} value={item.name}>
									{item.label}
								</option>
							))}
						</select>
					</label>
					<button
						className={outlineButtonClass}
						onClick={() => restart()}
						type="button"
					>
						<RotateCcw aria-hidden="true" size={18} />새 게임
					</button>
				</fieldset>
			</section>

			<section
				className="my-4 flex min-h-11 items-center justify-between gap-4 bg-black px-3 font-['Space_Mono'] text-xs uppercase tracking-[1px] text-white"
				aria-live="polite"
			>
				<span>{statusText(state)}</span>
				<strong className="whitespace-nowrap">
					질문 {state.questionDeck.length}장 남음
				</strong>
			</section>

			<div className="grid gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(440px,1.35fr)_minmax(280px,0.85fr)] xl:items-start">
				<div className="grid content-start gap-5 xl:col-start-1 xl:row-start-1">
					<TileRack code={state.computerCode} hidden label="컴퓨터 암호" />
					<TileRack code={state.humanCode} label="내 암호" />
				</div>

				<div className="xl:col-start-2 xl:row-start-1">
					<QuestionPanel
						onAsk={handleAsk}
						onSelectAction={setSelectedAction}
						selectedAction={selectedAction}
						state={state}
					/>
				</div>

				<aside className="grid content-start gap-5 xl:col-start-3 xl:row-start-1">
					<GuessPanel
						colors={guessColors}
						disabled={disabled}
						numbers={guessNumbers}
						onColorChange={(index, color) =>
							setGuessColors((current) =>
								current.map((item, itemIndex) =>
									itemIndex === index ? color : item,
								),
							)
						}
						onGuess={handleGuess}
						onNumberChange={(index, number) =>
							setGuessNumbers((current) =>
								current.map((item, itemIndex) =>
									itemIndex === index ? number : item,
								),
							)
						}
					/>
					<LogPanel state={state} />
				</aside>
			</div>

			<section
				className="mt-5 flex items-start gap-3 border-y border-black py-3"
				aria-label="룰 요약"
			>
				<ShieldQuestion aria-hidden="true" size={20} />
				<p className="m-0 leading-6">
					컴퓨터는 플레이어의 숨겨진 타일을 미리 보지 않습니다. 질문과 답을
					바탕으로만 추리합니다. 선언할 암호: {formatCode(currentGuess)}
				</p>
			</section>
		</main>
	);
}
