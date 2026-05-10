import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
	component: About,
});

function About() {
	return (
		<main className="mx-auto max-w-[1600px] px-4 py-5 text-[#1a1a1a] md:px-6">
			<section className="border-b-2 border-black pb-6">
				<div>
					<p className="font-['Space_Mono'] text-xs font-bold uppercase tracking-[1.2px]">
						게임 안내
					</p>
					<h1 className="mt-2 font-['Libre_Baskerville'] text-[clamp(2.4rem,10vw,5rem)] leading-[1.05] text-black">
						게임 규칙
					</h1>
					<p className="mt-4 max-w-3xl text-lg leading-8">
						2인전 기준으로 각 플레이어는 5개 타일을 숫자 오름차순으로 숨겨
						둡니다. 같은 숫자는 색상 순서에 따라 정렬합니다. 자신의 차례에는
						공개 질문 카드 중 하나를 골라 상대에게 묻거나, 상대의 다섯 타일을
						왼쪽부터 선언할 수 있습니다.
					</p>
				</div>
			</section>
			<section className="mt-5 border-t-2 border-black">
				<div className="inline-flex min-h-8 items-center bg-black px-3 font-['Space_Mono'] text-xs font-bold uppercase tracking-[1.2px] text-white">
					핵심 룰
				</div>
				<ol className="mt-3 list-decimal space-y-2 pl-6 leading-7">
					<li>질문 카드는 항상 중앙에 최대 6장 공개됩니다.</li>
					<li>
						질문을 받은 플레이어는 자신의 암호 기준으로 정직하게 답합니다.
					</li>
					<li>
						공유 정보 카드는 질문자도 같은 질문에 답해야 하므로 자기 정보가 새어
						나갑니다.
					</li>
					<li>정답 선언이 맞으면 즉시 승리하고, 틀리면 턴을 넘깁니다.</li>
					<li>
						컴퓨터는 플레이어의 숨겨진 타일을 미리 보지 않고, 주고받은 답만
						바탕으로 추리합니다.
					</li>
				</ol>
			</section>
		</main>
	);
}
