import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { DIFFICULTIES } from "#/lib/game";
import {
	clearStoredResults,
	loadStoredResults,
	type StoredGameResult,
} from "#/lib/game/results";

export const Route = createFileRoute("/history")({
	component: HistoryPage,
});

function resultLabel(result: StoredGameResult) {
	if (result.winner === "human") return "승리";
	if (result.winner === "computer") return "패배";
	return "무승부";
}

function resultTone(result: StoredGameResult) {
	if (result.winner === "human") return "bg-black text-white";
	if (result.winner === "computer") return "bg-white text-black";
	return "bg-[#f2f2f2] text-black";
}

function HistoryPage() {
	const [results, setResults] = useState<StoredGameResult[]>([]);

	useEffect(() => {
		setResults(loadStoredResults(window.localStorage));
	}, []);

	function clearHistory() {
		clearStoredResults(window.localStorage);
		setResults([]);
	}

	const wins = results.filter((result) => result.winner === "human").length;
	const losses = results.filter(
		(result) => result.winner === "computer",
	).length;

	return (
		<main className="mx-auto grid max-w-[1200px] gap-6 px-4 py-5 text-[#1a1a1a] md:px-6">
			<section className="grid gap-5 border-b-2 border-black pb-6 md:grid-cols-[minmax(0,1fr)_180px] md:items-end">
				<div>
					<p className="font-['Space_Mono'] text-xs font-bold uppercase tracking-[1.2px]">
						전적 보관함
					</p>
					<h1 className="mt-2 font-['Libre_Baskerville'] text-[clamp(2.5rem,12vw,5.5rem)] leading-[1.04] tracking-normal text-black">
						전적
					</h1>
					<p className="mt-3 max-w-2xl text-base leading-7">
						끝난 게임의 승패와 턴 수를 모아 둡니다. 진행 중인 게임이나 타일의
						비밀 정보는 남기지 않습니다.
					</p>
				</div>
				<button
					className="inline-flex min-h-11 items-center justify-center gap-2 border-2 border-black bg-white px-4 py-2 font-['Work_Sans'] font-bold uppercase text-black hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
					disabled={results.length === 0}
					onClick={clearHistory}
					type="button"
				>
					<Trash2 aria-hidden="true" size={18} />
					전체 삭제
				</button>
			</section>

			<section
				aria-label="전적 요약"
				className="grid grid-cols-3 border-t-2 border-l-2 border-black"
			>
				{[
					["전체", results.length],
					["승리", wins],
					["패배", losses],
				].map(([label, value]) => (
					<div className="border-r-2 border-b-2 border-black p-3" key={label}>
						<p className="font-['Work_Sans'] text-sm font-bold text-[#555]">
							{label}
						</p>
						<strong className="mt-1 block font-['Libre_Baskerville'] text-3xl">
							{value}
						</strong>
					</div>
				))}
			</section>

			<section className="border-t-2 border-black" aria-label="저장된 전적">
				<div className="inline-flex min-h-8 items-center bg-black px-3 font-['Space_Mono'] text-xs font-bold uppercase tracking-[1.2px] text-white">
					저장된 전적
				</div>
				{results.length === 0 ? (
					<div className="mt-3 border-2 border-black p-4">
						<p className="leading-7">아직 저장된 결과가 없습니다.</p>
					</div>
				) : (
					<ul className="mt-3 grid list-none gap-3 p-0">
						{results.map((result) => (
							<li
								className="grid gap-3 border-2 border-black p-3 sm:grid-cols-[120px_1fr] sm:items-center"
								key={result.id}
							>
								<strong
									className={`inline-flex min-h-10 items-center justify-center px-3 font-['Work_Sans'] text-sm font-bold ${resultTone(result)}`}
								>
									{resultLabel(result)}
								</strong>
								<div>
									<p className="font-['Work_Sans'] font-bold">
										{DIFFICULTIES[result.difficulty].label} /{" "}
										{result.turnNumber}턴
									</p>
									<p className="mt-1 text-sm leading-6 text-[#555]">
										{new Date(result.finishedAt).toLocaleString("ko-KR")}
									</p>
								</div>
							</li>
						))}
					</ul>
				)}
			</section>
		</main>
	);
}
