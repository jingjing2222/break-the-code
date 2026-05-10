# Break the Code

모바일 퍼스트 Break the Code(타기론) 웹 게임입니다. `/game`에서 사람 vs 컴퓨터 2인전 기준으로 플레이하며, 컴퓨터는 숨겨진 플레이어 패를 보지 않고 후보군 필터링으로만 추론합니다.

## Features

- 2인전 사람 vs 컴퓨터 플레이
- 초급, 중급, 고급, 전문가 난이도
- 하나의 공정한 후보군 필터링 AI 엔진
- 공개 질문 카드 6장 기반 질문/답변/교체 흐름
- 정답 추측 성공/실패와 턴 전환
- 완료된 게임 결과 localStorage 저장과 `/history` 전적 화면
- 모바일 퍼스트 반응형 UI
- WIRED풍 편집형 디자인: 흰 배경, 검정 룰, 사각 UI, 그림자/그라데이션 없음
- Vitest 단위 테스트와 Playwright E2E 테스트

## Getting Started

```bash
pnpm install
pnpm dev
```

개발 서버는 기본적으로 `http://localhost:3000`에서 실행됩니다.

## Scripts

```bash
pnpm test
pnpm check
pnpm build
pnpm exec playwright test
```

## Implementation Notes

- `PLAN.md`는 구현 범위와 검증 기준의 기준 문서입니다.
- `AGENTS.md`는 후속 작업자가 지켜야 할 AI 공정성, 타입, 디자인, 테스트 원칙입니다.
- AI 객체는 `myCode`, `candidates`, `difficulty`만 저장합니다.
- 내부 타일 색상 모델은 `R`, `B`, `G`를 사용하고, UI에는 한국어 색상 라벨을 표시합니다.
- 추론 로그는 `/game`에서 최신 이벤트 중심으로 보여주고, 저장 전적은 `/history`에서 분리해 보여줍니다.
- E2E 재현을 위해 URL query로 `seed`, `difficulty`, `first`를 받을 수 있습니다.
