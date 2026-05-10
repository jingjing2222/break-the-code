import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Brain, History, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
	component: Home,
});

function Home() {
	return (
		<main className="mx-auto grid max-w-[1600px] gap-6 px-4 py-5 text-[#1a1a1a] md:px-6">
			<section className="grid gap-6 border-b-2 border-black pb-8 md:grid-cols-[minmax(0,1fr)_280px] md:items-end">
				<div>
					<p className="font-['Space_Mono'] text-xs font-bold uppercase tracking-[1.2px]">
						숫자야구+
					</p>
					<h1 className="mt-2 font-['Libre_Baskerville'] text-[clamp(2.5rem,12vw,6rem)] leading-[1.04] tracking-normal text-black">
						숫자야구+
					</h1>
					<p className="mt-4 max-w-3xl font-['Source_Serif_4'] text-lg leading-8">
						질문 카드로 단서를 모아 상대의 다섯 타일을 먼저 맞히는 2인
						게임입니다. 컴퓨터는 난이도에 따라 신중하게 묻거나 과감하게 정답을
						선언합니다.
					</p>
				</div>
				<Link
					className="inline-flex min-h-12 items-center justify-center gap-2 border-2 border-black bg-white px-5 py-3 font-['Work_Sans'] font-bold uppercase text-black no-underline hover:bg-[#111114] hover:text-white"
					to="/game"
				>
					게임 시작
					<ArrowRight aria-hidden="true" size={18} />
				</Link>
			</section>

			<section className="grid gap-4 md:grid-cols-3">
				{[
					{
						icon: Brain,
						title: "네 가지 난이도",
						body: "초급부터 전문가까지, 컴퓨터의 질문 선택과 정답 선언 성향이 달라집니다.",
					},
					{
						icon: ShieldCheck,
						title: "정직한 승부",
						body: "컴퓨터는 플레이어의 숨겨진 타일을 미리 보지 않고, 주고받은 답만으로 추리합니다.",
					},
					{
						icon: History,
						title: "전적 저장",
						body: "끝난 게임의 승패와 턴 수를 전적 화면에서 다시 확인할 수 있습니다.",
					},
				].map((item) => (
					<article className="border border-black p-4" key={item.title}>
						<div className="mb-4 inline-flex size-10 items-center justify-center rounded-full border border-black">
							<item.icon aria-hidden="true" size={20} />
						</div>
						<h2 className="font-['Work_Sans'] text-lg font-semibold">
							{item.title}
						</h2>
						<p className="mt-2 leading-7">{item.body}</p>
					</article>
				))}
			</section>
		</main>
	);
}
