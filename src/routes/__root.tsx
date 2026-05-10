import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { OverlayProvider } from "overlay-kit";
import Footer from "../components/Footer";
import Header from "../components/Header";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "숫자야구 플러스",
			},
			{
				name: "description",
				content:
					"질문 카드로 상대의 다섯 타일 암호를 먼저 맞히는 숫자 추리 게임.",
			},
			{
				name: "theme-color",
				content: "#000000",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "icon",
				href: "/favicon.svg",
				type: "image/svg+xml",
			},
			{
				rel: "icon",
				href: "/favicon.ico",
				sizes: "any",
			},
			{
				rel: "apple-touch-icon",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "manifest",
				href: "/site.webmanifest",
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="ko">
			<head>
				<HeadContent />
			</head>
			<body>
				<OverlayProvider>
					<Header />
					{children}
					<Footer />
				</OverlayProvider>
				<Scripts />
			</body>
		</html>
	);
}
