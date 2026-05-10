# 숫자야구+ 모바일 웹 구현 계획

## Summary
- 기존 TanStack Start 예제 앱을 사람 vs 컴퓨터 2인전 숫자야구+ 앱으로 교체한다.
- AI는 난이도별 별도 로직이 아니라 하나의 후보군 필터링 추론 엔진을 사용하고, 난이도는 `clueDropRate`, `randomMoveRate`, `sampleLimit`, `scoreMode`, `guessConfidence`, `sharedInfoPenalty`, `lookaheadDepth` 설정만 다르게 둔다.
- AI 객체에는 `myCode`, `candidates`, `difficulty`만 넣고, 유저 실제 패나 비공개 덱/질문 정보는 절대 전달하지 않는다.
- UI는 `DESIGN.md`의 WIRED풍 원칙을 따른다: 모바일 퍼스트, 흰 배경, 검정 룰, 사각형, 그림자/그라데이션 없음.
- Playwright를 추가해 구현 중 모바일/데스크톱 화면과 주요 게임 플로우를 계속 검증한다.

## Key Changes
- 게임 엔진
  - 타일은 `Color = "R" | "B" | "G"`, `Tile { id, number, color }`, `Code = Tile[]` 모델로 둔다.
  - 정렬은 숫자 오름차순, 같은 숫자는 `R -> B -> G` 순서로 고정한다.
  - 2인전 기준 각자 5개 타일을 받고, AI 초기 후보군은 AI 자기 타일을 제외한 나머지 타일 중 5개 조합으로 만든다.
  - 정답 판정은 물리 `id`가 아니라 사용자가 보는 `color + number` 키 기준으로 한다.
  - 질문 카드는 “답변 함수”로 모델링하고, 공개 질문 카드 6장에서 합법 액션을 생성한다.

- AI
  - 공통 엔진은 `makeInitialCandidates`, `filterCandidates`, `questionPartitionStats`, `evaluateQuestionAction`, `expectedRemaining`, `worstCaseRemaining`, `bucketCandidates`, `lookaheadScore`, `shouldGuess`를 제공한다.
  - 질문 선택은 각 카드의 답변 분포를 bucket으로 나눈 뒤 내 정보 이득, 최악 케이스, 즉시 해결 확률, 공유 정보 누설, 상대에게 넘겼을 때의 위험도를 함께 계산한다.
  - 초급: 후보군은 유지하지만 단서 20% 누락, 랜덤 질문 65%, 샘플 150개, 65% 이상이면 성급 추측 가능.
  - 중급: 단서 5% 누락, 랜덤 질문 25%, 샘플 800개, 답변 종류 수가 많은 질문 선호, 85% 이상이면 추측.
  - 고급: 단서 누락 없음, 랜덤 8%, 전체 후보 기반 `expectedRemaining` 최소화, 공유 정보 누설 패널티 적용, 보이는 후보가 1개일 때만 추측.
  - 전문가: 랜덤 1%, 기대값 + 최악값 + 2수 앞 탐색 + 누설 패널티 + 상대에게 좋은 카드 제거 보너스, 확정 위주 추측.
  - `GameState.humanModel`은 플레이어가 컴퓨터 암호에 대해 알 수 있는 후보군을 공개 정보만으로 추적한다.
  - 모든 난이도는 `humanModel`을 받되 `opponentModelWeight`, 강제 선언 임계값을 다르게 둔다. 초급은 거의 무시하고, 중급은 약하게, 고급은 적극적으로, 전문가는 카드 차단과 위험 선언에 강하게 사용한다.
  - `ComputerPlayer`는 공정성 보장을 위해 실제 유저 패, 미공개 질문 카드, 전체 미사용 타일을 저장하지 않는다.

- UI/상태
- 홈(`/`)은 게임 진입 화면으로 두고, 실제 게임 화면은 `/game`에 둔다.
  - 모바일 화면은 상단 게임명/난이도, 상대 타일, 내 타일, 턴 리본, 질문 카드 6장, 하단 액션 영역 순서로 구성한다.
  - 데스크톱은 보드, 질문 패널, 추론 노트/로그를 3열 편집형 레이아웃으로 배치한다.
  - 상태 관리는 기존 의존성인 `@tanstack/store` 또는 React reducer를 사용하고, 불필요한 새 상태 라이브러리는 추가하지 않는다.
  - 아이콘은 기존 `lucide-react`를 사용한다.
  - 타입은 공개 도메인 모델과 함수 경계에만 선언하고, 로컬 변수/상수/컴포넌트 내부는 추론과 `as const`, `satisfies` 중심으로 작성한다.

- 라이브러리/도구
  - Playwright가 현재 설치되어 있지 않으므로 `@playwright/test`를 devDependency로 추가한다.
  - 브루트포스 후보군은 최대 3003개라 별도 조합 라이브러리 없이 작은 순수 유틸로 충분하다. 다만 컬렉션 헬퍼가 반복적으로 필요해지면 `remeda`를 추가해 `minBy`, `maxBy`, `sample` 계열을 사용한다.
  - 기존 컨퍼런스 예제 콘텐츠/라우트/AI assistant는 게임 앱에 맞게 제거하거나 비활성화한다.

## Test Plan
- 단위 테스트
  - 타일 덱 생성, 5장 분배, 정렬 규칙 검증
  - 후보군 초기 개수와 자기 타일 제외 검증
  - 질문 카드별 답변 함수 검증
  - 답변 관찰 후 후보군 필터링 검증
  - 플레이어가 얻은 답변과 공유 정보가 `humanModel` 후보군을 줄이는지 검증
  - 질문 가치 평가가 유용한 질문과 상대에게 넘기면 위험한 질문을 구분하는지 검증
  - visible candidate grouping과 추측 판단 검증
  - AI가 실제 유저 패 없이도 액션을 선택하는지 검증

- Playwright E2E
  - 모바일 viewport에서 새 게임 시작, 난이도 선택, 질문 선택, 답변 표시, 턴 전환 검증
  - 데스크톱 viewport에서 3열 레이아웃과 질문 카드 6장 표시 검증
  - AI 턴 후 로그/후보 수/턴 상태가 갱신되는지 검증
  - 정답 추측 성공/실패 플로우 검증
  - 접근 가능한 버튼 이름과 터치 타깃이 유지되는지 검증

- 최종 검증
  - `pnpm test`
  - `pnpm check`
  - `pnpm build`
  - `pnpm exec playwright test`
  - 로컬 dev server에서 Playwright 스크린샷으로 모바일/데스크톱 UI 확인

## Assumptions
- v1은 2인전 사람 vs 컴퓨터만 구현한다.
- 공식/공개 룰에 맞춰 타일은 3색 모델(`R`, `B`, `G`)로 구현하고, UI 문구는 한국어 중심으로 작성한다.
- 질문 카드 전체 목록은 구현 시 룰북 기준으로 확정하되, 모든 카드는 같은 `QuestionAction -> Answer` 인터페이스를 따른다.
- AI 난이도 차이는 추론 엔진을 나누지 않고 설정값 차이로만 만든다.
- 완료된 게임 결과는 localStorage에 저장하고 `/history`에서 확인한다. 플레이 중 상태 저장은 v1 필수 범위에서 제외한다.
