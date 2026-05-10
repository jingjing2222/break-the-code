import {
	Brain,
	Check,
	HelpCircle,
	KeyRound,
	NotebookPen,
	ScrollText,
	Send,
	X,
} from "lucide-react";
import { overlay, useOverlayData } from "overlay-kit";
import {
	type ReactNode,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
import ClientOnly from "#/components/ClientOnly";
import { DIFFICULTIES } from "#/lib/game/ai";
import {
	askQuestion,
	createGame,
	getLegalActionsForCard,
	guessCode,
	runComputerTurn,
} from "#/lib/game/engine";
import {
	formatAction,
	formatAnswerForLog,
	getQuestionCard,
} from "#/lib/game/questions";
import { createStoredResult, saveStoredResult } from "#/lib/game/results";
import { colorLabels, createSeededRandom, sortCode } from "#/lib/game/tiles";
import type {
	Code,
	Color,
	DifficultyName,
	GameState,
	Player,
	QuestionAction,
} from "#/lib/game/types";

const colorOptions = ["R", "B", "G"] as const;
const guessSlots = ["A", "B", "C", "D", "E"] as const;

const ribbonClass =
	"inline-flex min-h-8 items-center bg-[#111114] px-3 font-['Space_Mono'] text-xs font-bold uppercase tracking-[1.2px] text-white";
const outlineButtonClass =
	"inline-flex min-h-11 items-center justify-center gap-2 border-2 border-black bg-white px-4 py-2 font-['Work_Sans'] font-bold uppercase text-black hover:bg-[#111114] hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
const memoStorageKey = "break-the-code:memo:v1";
const memoOverlayId = "game-memo";
const resultOverlayId = "game-result";
const emptyGuessColors = [null, null, null, null, null] as const;
const emptyGuessNumbers = ["", "", "", "", ""] as const;

function getInitialDifficulty() {
	if (typeof window === "undefined") {
		return "intermediate";
	}
	const difficulty = new URLSearchParams(window.location.search).get(
		"difficulty",
	);
	return difficulty && difficulty in DIFFICULTIES
		? (difficulty as DifficultyName)
		: "intermediate";
}

function getInitialSeed() {
	if (typeof window === "undefined") {
		return undefined;
	}
	const raw = new URLSearchParams(window.location.search).get("seed");
	if (!raw) {
		return undefined;
	}
	const seed = Number(raw);
	return Number.isFinite(seed) ? seed : undefined;
}

function getInitialStartingPlayer() {
	if (typeof window === "undefined") {
		return undefined;
	}
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

function getInitialGameOptions(): {
	difficulty: DifficultyName;
	seed?: number;
	startingPlayer?: Player;
} {
	const difficulty = getInitialDifficulty();

	return {
		difficulty,
		seed: getInitialSeed(),
		startingPlayer: getInitialStartingPlayer(),
	};
}

type GameAppState = {
	difficulty: DifficultyName;
	game: GameState;
	selectedAction: QuestionAction | null;
	guessColors: readonly (Color | null)[];
	guessNumbers: readonly string[];
};

type InitialGameOptions = ReturnType<typeof getInitialGameOptions>;

type GameAppAction =
	| {
			type: "restart";
			difficulty: DifficultyName;
			seed?: number;
			startingPlayer?: Player;
	  }
	| { type: "selectAction"; action: QuestionAction | null }
	| { type: "askHuman" }
	| { type: "runComputerTurn" }
	| { type: "guessHuman"; guess: Code }
	| { type: "setGuessColor"; index: number; color: Color }
	| { type: "setGuessNumber"; index: number; number: string };

function createGameAppState(options: InitialGameOptions): GameAppState {
	return {
		difficulty: options.difficulty,
		game: createInitialGame(
			options.difficulty,
			options.seed,
			options.startingPlayer,
		),
		selectedAction: null,
		guessColors: emptyGuessColors,
		guessNumbers: emptyGuessNumbers,
	};
}

function gameAppReducer(
	state: GameAppState,
	action: GameAppAction,
): GameAppState {
	switch (action.type) {
		case "restart":
			return {
				...state,
				difficulty: action.difficulty,
				game: createInitialGame(
					action.difficulty,
					action.seed,
					action.startingPlayer,
				),
				selectedAction: null,
				guessColors: emptyGuessColors,
				guessNumbers: emptyGuessNumbers,
			};
		case "selectAction":
			return {
				...state,
				selectedAction: action.action,
			};
		case "askHuman":
			if (!state.selectedAction) {
				return state;
			}
			return {
				...state,
				game: askQuestion(state.game, "human", state.selectedAction),
				selectedAction: null,
			};
		case "runComputerTurn":
			return {
				...state,
				game: runComputerTurn(state.game),
			};
		case "guessHuman":
			return {
				...state,
				game: guessCode(state.game, "human", action.guess),
			};
		case "setGuessColor":
			return {
				...state,
				guessColors: state.guessColors.map((item, itemIndex) =>
					itemIndex === action.index
						? item === action.color
							? null
							: action.color
						: item,
				),
			};
		case "setGuessNumber":
			return {
				...state,
				guessNumbers: state.guessNumbers.map((item, itemIndex) =>
					itemIndex === action.index ? action.number : item,
				),
			};
	}
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

function hasAllGuessColors(
	colors: readonly (Color | null)[],
): colors is readonly Color[] {
	return colors.every((color) => color !== null);
}

function hasAllGuessNumbers(numbers: readonly string[]) {
	return numbers.every((number) => /^\d$/.test(number));
}

function statusText(state: GameState) {
	if (state.status === "human-won") {
		return "플레이어가 암호를 해독했습니다.";
	}
	if (state.status === "computer-won") {
		return "컴퓨터가 먼저 해독했습니다.";
	}
	if (state.status === "tie") {
		return "동점입니다.";
	}
	if (state.status === "exhausted") {
		return "질문 카드가 모두 소진되었습니다.";
	}
	return state.turn === "human" ? "플레이어 차례" : "컴퓨터 차례";
}

function resultText(status: GameState["status"]) {
	if (status === "human-won") {
		return {
			title: "승리",
			subtitle: "컴퓨터의 암호를 해독했습니다.",
			accent: "#22863a",
		};
	}

	if (status === "computer-won") {
		return {
			title: "패배",
			subtitle: "컴퓨터가 먼저 암호를 맞혔습니다.",
			accent: "#c62828",
		};
	}

	if (status === "tie") {
		return {
			title: "동점",
			subtitle: "서로 같은 순간에 암호를 맞혔습니다.",
			accent: "#1264a3",
		};
	}

	return {
		title: "종료",
		subtitle: "질문 카드가 모두 소진되었습니다.",
		accent: "#1a1a1a",
	};
}

function isFinishedStatus(
	status: GameState["status"] | undefined,
): status is Exclude<GameState["status"], "playing"> {
	return status !== undefined && status !== "playing";
}

function logKindLabel(kind: GameState["log"][number]["kind"]) {
	if (kind === "ask") {
		return "질문";
	}
	if (kind === "guess") {
		return "정답 선언";
	}
	return "안내";
}

function tileColorClass(color: Color) {
	if (color === "R") {
		return "border-t-[#c62828]";
	}
	if (color === "B") {
		return "border-t-[#1264a3]";
	}
	return "border-t-[#22863a]";
}

function colorSwatchClass(color: Color, selected: boolean) {
	const colorClass =
		color === "R"
			? "border-[#c62828] text-[#c62828]"
			: color === "B"
				? "border-[#1264a3] text-[#1264a3]"
				: "border-[#22863a] text-[#22863a]";

	return `min-h-10 border-2 px-2 font-['Work_Sans'] text-xs font-bold transition-colors hover:bg-[#111114] hover:text-white focus-visible:bg-[#111114] focus-visible:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
		selected
			? `${colorClass} bg-[#111114] text-white`
			: `${colorClass} bg-white`
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
							<h3 className="mt-2 font-['Work_Sans'] text-base font-semibold">
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
													? "bg-[#111114] text-white"
													: "bg-white text-black hover:bg-[#111114] hover:text-white"
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
	helperText,
}: {
	colors: readonly (Color | null)[];
	numbers: readonly string[];
	onColorChange: (index: number, color: Color) => void;
	onNumberChange: (index: number, number: string) => void;
	onGuess: () => void;
	disabled: boolean;
	helperText: string;
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
									onNumberChange(index, digit);
								}}
								pattern="[0-9]"
								placeholder="-"
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
			<p className="mt-2 text-sm leading-6 text-[#555]" aria-live="polite">
				{helperText}
			</p>
		</section>
	);
}

function MemoOverlay({
	isOpen,
	close,
}: {
	isOpen: boolean;
	close: () => void;
}) {
	const [memo, setMemo] = useState(() =>
		typeof window === "undefined"
			? ""
			: (window.localStorage.getItem(memoStorageKey) ?? ""),
	);

	function updateMemo(value: string) {
		setMemo(value);
		window.localStorage.setItem(memoStorageKey, value);
	}

	if (!isOpen) {
		return null;
	}

	return (
		<div
			aria-label="메모장"
			className="fixed right-4 bottom-20 z-50 w-[min(calc(100vw-2rem),380px)] border-2 border-black bg-white p-3 text-[#1a1a1a]"
			role="dialog"
		>
			<div className="flex items-center justify-between gap-3 border-b-2 border-black pb-2">
				<div className="flex items-center gap-2">
					<NotebookPen aria-hidden="true" size={20} />
					<h2 className="font-['Work_Sans'] text-base font-semibold">메모장</h2>
				</div>
				<button
					aria-label="메모장 닫기"
					className="grid size-9 place-items-center border-2 border-black bg-white hover:bg-[#111114] hover:text-white"
					onClick={close}
					type="button"
				>
					<X aria-hidden="true" size={18} />
				</button>
			</div>
			<textarea
				aria-label="게임 메모"
				className="mt-3 min-h-[220px] w-full resize-y border-2 border-black bg-white p-3 font-['Source_Serif_4'] text-lg leading-7 outline-none focus:ring-2 focus:ring-black"
				onChange={(event) => updateMemo(event.target.value)}
				placeholder="의심되는 색, 숫자, 질문 결과를 적어두세요."
				value={memo}
			/>
		</div>
	);
}

function closeOverlayWithDelay(overlayId: string) {
	overlay.close(overlayId);
	window.setTimeout(() => overlay.unmount(overlayId), 150);
}

function openMemoOverlay() {
	overlay.open(
		({ isOpen, close, unmount }) => (
			<MemoOverlay
				close={() => {
					close();
					window.setTimeout(unmount, 150);
				}}
				isOpen={isOpen}
			/>
		),
		{ overlayId: memoOverlayId },
	);
}

function BottomSheetOverlay({
	children,
	close,
	isOpen,
	label,
	title,
}: {
	children: ReactNode;
	close: () => void;
	isOpen: boolean;
	label: string;
	title: string;
}) {
	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-50 grid items-end p-0 md:inset-0 md:items-center md:p-6">
			<button
				aria-label={`${label} 닫기`}
				className="absolute inset-0 bg-white/70 backdrop-blur-sm"
				onClick={close}
				type="button"
			/>
			<section
				aria-label={label}
				className="relative max-h-[82vh] overflow-y-auto border-t-2 border-black bg-white p-4 shadow-[0_-6px_0_#111114] md:mx-auto md:w-[min(760px,calc(100vw-3rem))] md:border-2 md:shadow-[6px_6px_0_#111114]"
				role="dialog"
			>
				<div className="mb-3 flex items-center justify-between gap-3 border-b-2 border-black pb-2">
					<h2 className="font-['Work_Sans'] text-base font-semibold">
						{title}
					</h2>
					<button
						aria-label={`${label} 닫기`}
						className="grid size-9 place-items-center border-2 border-black bg-white hover:bg-[#111114] hover:text-white"
						onClick={close}
						type="button"
					>
						<X aria-hidden="true" size={18} />
					</button>
				</div>
				{children}
			</section>
		</div>
	);
}

function ResultOverlay({
	close,
	isOpen,
	status,
}: {
	close: () => void;
	isOpen: boolean;
	status: Exclude<GameState["status"], "playing">;
}) {
	const copy = resultText(status);

	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-[60] grid place-items-center p-4">
			<button
				aria-label="게임 결과 닫기"
				className="absolute inset-0 bg-white/70 backdrop-blur-sm"
				onClick={close}
				type="button"
			/>
			<section
				aria-label="게임 결과"
				className="relative w-[min(calc(100vw-2rem),440px)] border-2 border-black bg-white p-5 text-center shadow-[8px_8px_0_#000]"
				role="dialog"
			>
				<svg
					aria-hidden="true"
					className="mx-auto size-44"
					viewBox="0 0 180 180"
				>
					<title>{copy.title}</title>
					<circle
						cx="90"
						cy="90"
						fill="white"
						r="54"
						stroke="black"
						strokeWidth="4"
					/>
					<circle
						cx="90"
						cy="90"
						fill="none"
						r="70"
						stroke={copy.accent}
						strokeDasharray="18 12"
						strokeLinecap="square"
						strokeWidth="6"
					>
						<animateTransform
							attributeName="transform"
							dur="3.4s"
							from="0 90 90"
							repeatCount="indefinite"
							to="360 90 90"
							type="rotate"
						/>
					</circle>
					<g fill={copy.accent}>
						<rect height="16" rx="2" width="16" x="31" y="36">
							<animate
								attributeName="opacity"
								dur="1.4s"
								repeatCount="indefinite"
								values="0.2;1;0.2"
							/>
						</rect>
						<rect height="12" rx="2" width="12" x="135" y="48">
							<animate
								attributeName="opacity"
								begin="0.2s"
								dur="1.4s"
								repeatCount="indefinite"
								values="0.2;1;0.2"
							/>
						</rect>
						<rect height="14" rx="2" width="14" x="128" y="126">
							<animate
								attributeName="opacity"
								begin="0.4s"
								dur="1.4s"
								repeatCount="indefinite"
								values="0.2;1;0.2"
							/>
						</rect>
					</g>
					<path
						d={
							status === "human-won"
								? "M57 92 L78 113 L124 67"
								: status === "computer-won"
									? "M62 62 L118 118 M118 62 L62 118"
									: "M55 90 H125"
						}
						fill="none"
						stroke="black"
						strokeLinecap="square"
						strokeLinejoin="round"
						strokeWidth="10"
					>
						<animate
							attributeName="stroke-dasharray"
							dur="1.1s"
							fill="freeze"
							from="0 180"
							to="180 0"
						/>
					</path>
				</svg>
				<p className="m-0 mt-2 font-['Space_Mono'] text-xs font-bold uppercase tracking-[1.2px] text-[#555]">
					게임 결과
				</p>
				<h2 className="m-0 mt-2 font-['Libre_Baskerville'] text-5xl leading-none">
					{copy.title}
				</h2>
				<p className="mt-3 text-lg leading-7">{copy.subtitle}</p>
				<p className="mt-4 border-t border-black pt-3 text-sm leading-6 text-[#555]">
					바깥 영역을 누르면 결과 화면이 닫힙니다.
				</p>
			</section>
		</div>
	);
}

function QuestionInfoToggle({ action }: { action: QuestionAction }) {
	const [hovered, setHovered] = useState(false);
	const [pinned, setPinned] = useState(false);
	const card = getQuestionCard(action.cardId);
	const actionLabel = formatAction(action);
	const open = hovered || pinned;

	return (
		<span className="relative inline-flex align-baseline">
			<button
				aria-expanded={open}
				aria-label={`${actionLabel} 질문 설명 토글`}
				className="mx-1 inline-flex min-h-7 items-center gap-1 border border-black bg-white px-2 py-0.5 font-['Work_Sans'] text-xs font-bold text-black transition-colors hover:bg-[#111114] hover:text-white focus-visible:bg-[#111114] focus-visible:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
				onClick={() => setPinned((current) => !current)}
				onMouseEnter={() => setHovered(true)}
				onMouseLeave={() => setHovered(false)}
				type="button"
			>
				{actionLabel}
				<HelpCircle aria-hidden="true" size={13} />
			</button>
			{open && (
				<span
					className="absolute top-full left-0 z-30 mt-2 w-[min(72vw,300px)] border-2 border-black bg-white p-3 text-left text-sm leading-6 shadow-[4px_4px_0_#000]"
					role="tooltip"
				>
					<strong className="block font-['Work_Sans'] text-sm">
						{card.title}
					</strong>
					<span className="mt-1 block">{card.prompt}</span>
					{card.isSharedInfo && (
						<span className="mt-2 inline-flex border border-black px-2 py-1 font-['Work_Sans'] text-xs font-bold">
							함께 답하는 질문
						</span>
					)}
				</span>
			)}
		</span>
	);
}

function AskLogText({ entry }: { entry: GameState["log"][number] }) {
	if (entry.kind !== "ask" || !entry.action) {
		return <p className="mt-1 leading-6">{entry.text}</p>;
	}

	const actorLabel = entry.actor === "human" ? "플레이어" : "컴퓨터";
	const owner = entry.actor === "human" ? "컴퓨터 암호" : "내 암호";
	const param = entry.action.param;

	if (entry.action.cardId === "visible-key-at-position") {
		const position =
			typeof param === "number"
				? ["A칸", "B칸", "C칸", "D칸", "E칸"][param]
				: "선택한 칸";

		return (
			<p className="mt-1 leading-6">
				{actorLabel}가 {owner}의 {position}을 공개하라고 물었습니다.
				<QuestionInfoToggle action={entry.action} />
			</p>
		);
	}

	if (entry.action.cardId === "where-number") {
		return (
			<p className="mt-1 leading-6">
				{actorLabel}가 {owner}에서 숫자 {param}이 있는 칸을 물었습니다.
				<QuestionInfoToggle action={entry.action} />
			</p>
		);
	}

	if (
		entry.action.cardId === "where-color" ||
		entry.action.cardId === "count-color"
	) {
		return (
			<p className="mt-1 leading-6">
				{actorLabel}가 {owner}에서{" "}
				{colorLabels[param as keyof typeof colorLabels]} 타일을 물었습니다.
				<QuestionInfoToggle action={entry.action} />
			</p>
		);
	}

	if (entry.action.cardId === "has-number") {
		return (
			<p className="mt-1 leading-6">
				{actorLabel}가 {owner}에 숫자 {param}이 있는지 물었습니다.
				<QuestionInfoToggle action={entry.action} />
			</p>
		);
	}

	if (entry.action.cardId === "count-greater-than") {
		return (
			<p className="mt-1 leading-6">
				{actorLabel}가 {owner}에서 {param}보다 큰 타일 개수를 물었습니다.
				<QuestionInfoToggle action={entry.action} />
			</p>
		);
	}

	return (
		<p className="mt-1 leading-6">
			{actorLabel}가 {owner}에 대해
			<QuestionInfoToggle action={entry.action} />
			질문을 했습니다.
		</p>
	);
}

function LogEntryList({
	emptyText,
	entries,
}: {
	emptyText: string;
	entries: GameState["log"];
}) {
	if (entries.length === 0) {
		return (
			<p className="border border-black p-3 text-sm leading-6 text-[#555]">
				{emptyText}
			</p>
		);
	}

	return (
		<ul className="grid list-none gap-2 p-0">
			{entries.map((entry) => {
				const targetLabel = entry.actor === "human" ? "컴퓨터" : "플레이어";
				const sharedLabel = entry.actor === "human" ? "플레이어" : "컴퓨터";

				return (
					<li className="border-b border-black pb-2" key={entry.id}>
						<div className="flex items-center justify-between gap-3">
							<span className="font-['Work_Sans'] text-xs font-bold text-[#555]">
								{logKindLabel(entry.kind)}
							</span>
						</div>
						<AskLogText entry={entry} />
						<div className="mt-1 flex flex-wrap gap-2">
							{entry.answer !== undefined && (
								<span className="inline-flex border border-black px-2 py-1 font-['Work_Sans'] text-xs font-bold">
									{entry.sharedAnswer === undefined
										? "답"
										: `${targetLabel} 답`}
									: {formatAnswerForLog(entry.answer)}
								</span>
							)}
							{entry.sharedAnswer !== undefined && (
								<span className="inline-flex border border-black px-2 py-1 font-['Work_Sans'] text-xs font-bold">
									{sharedLabel} 답: {formatAnswerForLog(entry.sharedAnswer)}
								</span>
							)}
						</div>
					</li>
				);
			})}
		</ul>
	);
}

function LogPanel({ state }: { state: GameState }) {
	const humanQuestionEntries = state.log.filter(
		(entry) => entry.actor === "human" && entry.kind === "ask",
	);
	const computerQuestionEntries = state.log.filter(
		(entry) => entry.actor === "computer" && entry.kind === "ask",
	);
	const otherEntries = state.log.filter((entry) => entry.kind !== "ask");

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
			<div className="mt-3 grid gap-3 md:grid-cols-2">
				<section className="border-2 border-black p-3" aria-label="내 질문">
					<h3 className="font-['Work_Sans'] text-base font-semibold">
						내 질문
					</h3>
					<div className="mt-3">
						<LogEntryList
							emptyText="아직 내가 질문하지 않았습니다."
							entries={humanQuestionEntries}
						/>
					</div>
				</section>
				<section className="border-2 border-black p-3" aria-label="컴퓨터 질문">
					<h3 className="font-['Work_Sans'] text-base font-semibold">
						컴퓨터 질문
					</h3>
					<div className="mt-3">
						<LogEntryList
							emptyText="아직 컴퓨터가 질문하지 않았습니다."
							entries={computerQuestionEntries}
						/>
					</div>
				</section>
			</div>
			{otherEntries.length > 0 && (
				<section
					className="mt-3 border border-black p-3"
					aria-label="그 외 기록"
				>
					<h3 className="font-['Work_Sans'] text-sm font-semibold">
						그 외 기록
					</h3>
					<ul className="mt-2 grid list-none gap-2 p-0">
						{otherEntries.map((entry) => (
							<li className="text-sm leading-6 text-[#555]" key={entry.id}>
								{entry.text}
							</li>
						))}
					</ul>
				</section>
			)}
		</section>
	);
}

function QuickOverlayBar({ state }: { state: GameState }) {
	const overlayData = useOverlayData();
	const [activePanel, setActivePanel] = useState<"code" | "log" | null>(null);
	const isMemoOpen = overlayData[memoOverlayId]?.isOpen === true;
	const isCodeOpen = activePanel === "code";
	const isLogOpen = activePanel === "log";

	function toggleCode() {
		if (isCodeOpen) {
			setActivePanel(null);
			return;
		}

		setActivePanel("code");
	}

	function toggleLog() {
		if (isLogOpen) {
			setActivePanel(null);
			return;
		}

		setActivePanel("log");
	}

	function toggleMemo() {
		if (isMemoOpen) {
			closeOverlayWithDelay(memoOverlayId);
			return;
		}

		openMemoOverlay();
	}

	return (
		<>
			<BottomSheetOverlay
				close={() => setActivePanel(null)}
				isOpen={isCodeOpen}
				label="암호 오버레이"
				title="암호"
			>
				<div className="grid gap-4">
					<TileRack code={state.computerCode} hidden label="컴퓨터 암호" />
					<TileRack code={state.humanCode} label="내 암호" />
				</div>
			</BottomSheetOverlay>
			<BottomSheetOverlay
				close={() => setActivePanel(null)}
				isOpen={isLogOpen}
				label="게임 기록 오버레이"
				title="게임 기록"
			>
				<LogPanel state={state} />
			</BottomSheetOverlay>
			<nav
				aria-label="빠른 보기"
				className="fixed right-0 bottom-0 left-0 z-[60] grid grid-cols-3 border-t-2 border-black bg-white pb-[env(safe-area-inset-bottom)] md:right-4 md:bottom-4 md:left-auto md:flex md:border-2 md:pb-0"
			>
				<button
					aria-pressed={isCodeOpen}
					className="inline-flex min-h-14 items-center justify-center gap-2 border-r border-black px-3 font-['Work_Sans'] text-sm font-bold text-black hover:bg-[#111114] hover:text-white aria-pressed:bg-[#111114] aria-pressed:text-white md:hidden"
					onClick={toggleCode}
					type="button"
				>
					<KeyRound aria-hidden="true" size={17} />
					암호
				</button>
				<button
					aria-pressed={isLogOpen}
					className="inline-flex min-h-14 items-center justify-center gap-2 border-r border-black px-3 font-['Work_Sans'] text-sm font-bold text-black hover:bg-[#111114] hover:text-white aria-pressed:bg-[#111114] aria-pressed:text-white md:hidden"
					onClick={toggleLog}
					type="button"
				>
					<ScrollText aria-hidden="true" size={17} />
					기록
				</button>
				<button
					aria-pressed={isMemoOpen}
					className="inline-flex min-h-14 items-center justify-center gap-2 px-3 font-['Work_Sans'] text-sm font-bold text-black hover:bg-[#111114] hover:text-white aria-pressed:bg-[#111114] aria-pressed:text-white md:min-h-12 md:px-4"
					onClick={toggleMemo}
					type="button"
				>
					<NotebookPen aria-hidden="true" size={17} />
					메모
				</button>
			</nav>
		</>
	);
}

function GameClient() {
	const initialGameOptionsRef = useRef<ReturnType<
		typeof getInitialGameOptions
	> | null>(null);
	if (initialGameOptionsRef.current === null) {
		initialGameOptionsRef.current = getInitialGameOptions();
	}

	const seedRef = useRef(initialGameOptionsRef.current.seed);
	const startingPlayerRef = useRef(
		initialGameOptionsRef.current.startingPlayer,
	);
	const [appState, dispatch] = useReducer(
		gameAppReducer,
		initialGameOptionsRef.current,
		createGameAppState,
	);
	const savedResultKeyRef = useRef<string | null>(null);
	const openedResultKeyRef = useRef<string | null>(null);
	const {
		difficulty,
		game: state,
		guessColors,
		guessNumbers,
		selectedAction,
	} = appState;

	const currentGuess = useMemo(
		() =>
			hasAllGuessColors(guessColors) && hasAllGuessNumbers(guessNumbers)
				? makeGuessCode(guessColors, guessNumbers.map(Number))
				: null,
		[guessColors, guessNumbers],
	);
	const resultStatus = state?.status;
	const resultTurnNumber = state?.turnNumber;
	const resultLogId = state?.log[0]?.id;

	useEffect(() => {
		if (state.turn !== "computer" || state.status !== "playing") {
			return;
		}

		const timer = window.setTimeout(() => {
			dispatch({ type: "runComputerTurn" });
		}, 450);

		return () => window.clearTimeout(timer);
	}, [state]);

	useEffect(() => {
		if (state.status === "playing") {
			return;
		}

		const resultKey = `${state.status}-${state.turnNumber}-${state.log[0]?.id}`;
		if (savedResultKeyRef.current === resultKey) {
			return;
		}

		const result = createStoredResult(state);
		if (!result) {
			return;
		}

		saveStoredResult(window.localStorage, result);
		savedResultKeyRef.current = resultKey;
	}, [state]);

	useEffect(() => {
		if (!resultStatus) {
			return;
		}
		if (!isFinishedStatus(resultStatus)) {
			openedResultKeyRef.current = null;
			return;
		}

		const finishedStatus = resultStatus;
		const resultKey = `${resultStatus}-${resultTurnNumber}-${resultLogId}`;
		if (openedResultKeyRef.current === resultKey) {
			return;
		}
		openedResultKeyRef.current = resultKey;

		overlay.open(
			({ isOpen, close, unmount }) => (
				<ResultOverlay
					close={() => {
						close();
						window.setTimeout(unmount, 150);
					}}
					isOpen={isOpen}
					status={finishedStatus}
				/>
			),
			{ overlayId: resultOverlayId },
		);
	}, [resultLogId, resultStatus, resultTurnNumber]);

	function restart(nextDifficulty = difficulty) {
		openedResultKeyRef.current = null;
		overlay.close(resultOverlayId);
		window.setTimeout(() => overlay.unmount(resultOverlayId), 150);
		savedResultKeyRef.current = null;
		dispatch({
			type: "restart",
			difficulty: nextDifficulty,
			seed: seedRef.current,
			startingPlayer: startingPlayerRef.current,
		});
	}

	function handleAsk() {
		if (!selectedAction) {
			return;
		}
		dispatch({ type: "askHuman" });
	}

	function handleGuess() {
		if (!currentGuess) {
			return;
		}
		dispatch({ type: "guessHuman", guess: currentGuess });
	}

	const disabled = state.turn !== "human" || state.status !== "playing";
	const guessDisabled = disabled || !currentGuess;
	const guessHelperText = !currentGuess
		? "다섯 칸의 색과 숫자를 모두 채우면 제출할 수 있습니다."
		: state.status !== "playing"
			? "게임이 종료되었습니다."
			: state.turn !== "human"
				? "컴퓨터 차례가 끝나면 제출할 수 있습니다."
				: "정답을 제출할 수 있습니다.";

	return (
		<>
			<fieldset className="mt-5 grid content-start gap-2 md:max-w-[260px]">
				<legend className="font-['Space_Mono'] text-xs font-bold uppercase tracking-[1px]">
					게임 설정
				</legend>
				<label className="grid gap-1 font-['Space_Mono'] text-xs font-bold uppercase tracking-[1px]">
					난이도
					<select
						className="min-h-11 border-2 border-black bg-white px-3 py-2 font-['Work_Sans'] text-base font-bold text-black"
						onChange={(event) => restart(event.target.value as DifficultyName)}
						value={difficulty}
					>
						{Object.values(DIFFICULTIES).map((item) => (
							<option key={item.name} value={item.name}>
								{item.label}
							</option>
						))}
					</select>
				</label>
			</fieldset>
			<section
				className="my-4 flex min-h-11 items-center justify-between gap-4 bg-[#111114] px-3 font-['Space_Mono'] text-xs uppercase tracking-[1px] text-white"
				aria-live="polite"
			>
				<span>{statusText(state)}</span>
				<strong className="whitespace-nowrap">
					질문 {state.questionDeck.length}장 남음
				</strong>
			</section>

			<div className="grid gap-5 xl:grid-cols-[minmax(440px,1.35fr)_minmax(280px,0.85fr)] xl:items-start">
				<div>
					<QuestionPanel
						onAsk={handleAsk}
						onSelectAction={(action) =>
							dispatch({ type: "selectAction", action })
						}
						selectedAction={selectedAction}
						state={state}
					/>
					<div className="mt-5 hidden gap-4 md:grid">
						<TileRack code={state.computerCode} hidden label="컴퓨터 암호" />
						<TileRack code={state.humanCode} label="내 암호" />
					</div>
				</div>

				<aside className="grid content-start gap-5">
					<GuessPanel
						colors={guessColors}
						disabled={guessDisabled}
						helperText={guessHelperText}
						numbers={guessNumbers}
						onColorChange={(index, color) =>
							dispatch({ type: "setGuessColor", color, index })
						}
						onGuess={handleGuess}
						onNumberChange={(index, number) =>
							dispatch({ type: "setGuessNumber", index, number })
						}
					/>
					<div className="hidden md:block">
						<LogPanel state={state} />
					</div>
				</aside>
			</div>

			<QuickOverlayBar state={state} />
		</>
	);
}

function GameFallback() {
	return (
		<div className="mt-5 grid gap-5 xl:grid-cols-[minmax(440px,1.35fr)_minmax(280px,0.85fr)] xl:items-start">
			<section className="border-t-2 border-black" aria-label="질문 카드">
				<div className={ribbonClass}>공개 질문 카드 6장</div>
				<div className="mt-3 border-2 border-black p-4">
					<p className="leading-7">게임을 준비하고 있습니다.</p>
				</div>
			</section>
			<aside className="grid content-start gap-5">
				<section className="border-t-2 border-black" aria-label="정답 추측">
					<div className={ribbonClass}>정답 선언</div>
					<div className="mt-3 border-2 border-black p-4">
						<p className="leading-7">암호 입력판을 불러오고 있습니다.</p>
					</div>
				</section>
			</aside>
		</div>
	);
}

export default function GameApp() {
	return (
		<main className="mx-auto max-w-[1600px] px-4 pt-4 pb-[calc(9rem+env(safe-area-inset-bottom))] text-[#1a1a1a] md:px-6 md:pb-4">
			<section
				className="border-b-2 border-black py-5"
				aria-labelledby="game-title"
			>
				<p className="m-0 font-['Space_Mono'] text-xs font-bold uppercase tracking-[1.2px]">
					숫자야구+
				</p>
				<h1
					className="m-0 mt-2 font-['Libre_Baskerville'] text-[clamp(2.4rem,11vw,5.5rem)] leading-[1.05] tracking-normal text-black"
					id="game-title"
				>
					숫자야구+
				</h1>
				<p className="mt-3 max-w-3xl text-base leading-7">
					공개 질문 카드 6장을 골라 컴퓨터의 5개 암호 타일을 먼저 맞히십시오.
					난이도가 높을수록 컴퓨터는 더 신중하게 질문하고 확실할 때 정답을
					선언합니다.
				</p>
			</section>
			<ClientOnly fallback={<GameFallback />}>
				<GameClient />
			</ClientOnly>
		</main>
	);
}
