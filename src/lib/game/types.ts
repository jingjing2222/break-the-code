export const COLORS = ["R", "B", "G"] as const;

export type Color = (typeof COLORS)[number];

export type Tile = {
	id: string;
	number: number;
	color: Color;
};

export type Code = Tile[];

export type Answer = string | number | boolean;

export type QuestionAction = {
	cardId: string;
	param?: string | number;
	isSharedInfo: boolean;
};

export type QuestionCard = {
	id: string;
	title: string;
	prompt: string;
	isSharedInfo: boolean;
	params?: readonly (string | number)[];
	answer: (action: QuestionAction, code: Code) => Answer;
};

export type DifficultyName =
	| "beginner"
	| "intermediate"
	| "advanced"
	| "expert";

export type ScoreMode =
	| "random_or_simple"
	| "distinct_answer_count"
	| "expected_remaining"
	| "minimax_plus_lookahead";

export type GuessMode = "risky" | "mostly_safe" | "safe" | "safe_or_forced";

export type DifficultyConfig = {
	name: DifficultyName;
	label: string;
	useFullCandidateFiltering: true;
	clueDropRate: number;
	randomMoveRate: number;
	sampleLimit: number;
	scoreMode: ScoreMode;
	guessMode: GuessMode;
	guessConfidence: number;
	sharedInfoPenalty: number;
	lookaheadDepth: number;
	denyOpponentGoodCards: boolean;
	opponentModelWeight: number;
	worstCaseWeight: number;
	solveChanceWeight: number;
	opponentDenyWeight: number;
	forcedGuessOpponentConfidence: number;
	forcedGuessSelfConfidence: number;
	forcedGuessQuestionThreshold: number;
};

export type ComputerPlayer = {
	myCode: Code;
	candidates: Code[];
	difficulty: DifficultyConfig;
};

export type OpponentModel = {
	candidates: Code[];
};

export type Player = "human" | "computer";

export type GameStatus =
	| "playing"
	| "human-won"
	| "computer-won"
	| "tie"
	| "exhausted";

export type GameLogEntry = {
	id: string;
	actor: Player;
	kind: "ask" | "guess" | "system";
	text: string;
	action?: QuestionAction;
	answer?: Answer;
	sharedAnswer?: Answer;
	candidatesAfter?: number;
};

export type GameState = {
	deck: Tile[];
	humanCode: Code;
	computerCode: Code;
	questionDeck: QuestionCard[];
	visibleQuestionCards: QuestionCard[];
	computer: ComputerPlayer;
	humanModel: OpponentModel;
	turn: Player;
	status: GameStatus;
	startingPlayer: Player;
	turnNumber: number;
	log: GameLogEntry[];
	lastAnswer?: Answer;
};
