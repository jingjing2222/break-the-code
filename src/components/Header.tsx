import { Link } from "@tanstack/react-router";
import { Home } from "lucide-react";

export default function Header() {
	return (
		<header className="sticky top-0 z-20 border-b-2 border-black bg-white">
			<nav
				aria-label="주요 메뉴"
				className="mx-auto flex min-h-[58px] max-w-[1600px] items-center justify-between gap-3 px-4 md:px-6"
			>
				<Link
					className="font-['Space_Mono'] text-xs font-bold uppercase tracking-[1px] text-black no-underline hover:text-[#057dbc] hover:underline sm:text-sm sm:tracking-[1.2px]"
					to="/"
				>
					숫자야구+
				</Link>
				<div className="flex gap-3 font-['Work_Sans'] text-xs font-bold uppercase sm:gap-5 sm:text-sm">
					<Link
						activeProps={{ className: "text-[#057dbc] underline" }}
						aria-label="홈"
						className="inline-flex items-center gap-1 text-black no-underline hover:text-[#057dbc] hover:underline"
						to="/"
					>
						<Home aria-hidden="true" size={15} />홈
					</Link>
					<Link
						activeProps={{ className: "text-[#057dbc] underline" }}
						className="text-black no-underline hover:text-[#057dbc] hover:underline"
						to="/game"
					>
						게임
					</Link>
					<Link
						activeProps={{ className: "text-[#057dbc] underline" }}
						className="text-black no-underline hover:text-[#057dbc] hover:underline"
						to="/about"
					>
						규칙
					</Link>
					<Link
						activeProps={{ className: "text-[#057dbc] underline" }}
						className="text-black no-underline hover:text-[#057dbc] hover:underline"
						to="/history"
					>
						전적
					</Link>
				</div>
			</nav>
		</header>
	);
}
