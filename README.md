# Break the Code

모바일 퍼스트로 만든 Break the Code(타기론) 웹 게임입니다. 사람과 컴퓨터가 2인전으로 플레이하며, 공개 질문 카드 6장 중 하나를 골라 상대의 다섯 타일 암호를 먼저 맞히는 흐름입니다.

## 주요 기능

- 사람 vs 컴퓨터 2인전 플레이
- 초급, 중급, 고급, 전문가 난이도
- 후보군 필터링 기반 공정 AI
- 질문 카드 선택, 답변 기록, 컴퓨터 턴 자동 진행
- 색상 토글과 숫자 입력 기반 정답 선언 UI
- 게임 결과 오버레이와 localStorage 전적 저장
- `/history` 전적 페이지 분리
- 모바일 하단 탭으로 암호, 기록, 메모 빠른 접근
- 데스크톱 질문 영역 하단 타일 보드와 스티키 메모
- Tailwind CSS 기반 반응형 UI
- Vitest 단위 테스트와 Playwright E2E 테스트

## AI 원칙

컴퓨터는 플레이어의 실제 암호를 직접 보지 않습니다. 게임 엔진은 정답을 알고 있지만, AI 객체에는 실제 플레이어 패를 넘기지 않고 다음 정보만 유지합니다.

- 자신의 암호
- 현재 가능한 상대 암호 후보군
- 난이도 설정

AI는 자신의 타일을 제외한 나머지 타일로 가능한 상대 후보군을 만들고, 질문과 답변을 받을 때마다 후보군을 줄입니다. 난이도는 별도의 치팅 로직이 아니라 같은 추론 엔진 위에서 기억 정확도, 질문 평가 방식, 랜덤성, 위험 감수 성향을 다르게 둡니다.

## 화면 구성

- `/`: 소개와 게임 시작 진입
- `/game`: 실제 게임 화면
- `/about`: 규칙 안내
- `/history`: 저장된 전적

모바일에서는 하단 탭에서 암호, 기록, 메모를 오버레이로 확인합니다. 데스크톱에서는 질문 카드 아래에 컴퓨터 암호와 내 암호를 표시하고, 빠른 보기에는 메모만 노출합니다.

## 시작하기

```bash
pnpm install
pnpm dev
```

개발 서버는 기본적으로 `http://localhost:3000`에서 실행됩니다.

## 스크립트

```bash
pnpm check
pnpm test
pnpm e2e
pnpm build
pnpm deploy
```

## 테스트

- `pnpm test`: 게임 엔진, 질문, AI 추론 단위 테스트
- `pnpm e2e`: 모바일/데스크톱 Playwright 플로우 테스트
- `pnpm build`: 클라이언트와 SSR 빌드 검증

E2E 재현을 위해 게임 URL에서 `seed`, `difficulty`, `first` query를 사용할 수 있습니다.

```text
/game?seed=31&difficulty=beginner&first=human
```

## 배포

이 프로젝트는 TanStack Start SSR 앱이라 Cloudflare Pages 정적 사이트가 아니라 Cloudflare Workers로 배포합니다. `pnpm build`를 실행하면 Vite가 다음 산출물을 만듭니다.

```text
dist/client  # 정적 에셋
dist/server  # Worker SSR 번들
```

`wrangler deploy`는 `dist/server/wrangler.json`을 사용하고, `dist/client`를 Worker assets로 함께 업로드합니다.

### Cloudflare 대시보드에서 배포

토큰을 GitHub Secrets에 넣지 않고 Cloudflare에서 직접 연결하려면 Workers Builds를 사용합니다.

1. Cloudflare Dashboard에서 **Workers & Pages**로 이동
2. **Create application** 선택
3. **Import a repository**에서 GitHub 계정과 `jingjing2222/break-the-code` 저장소 선택
4. 프로젝트를 Worker로 생성하고 이름을 `break-the-code`로 설정
5. 빌드 설정을 다음처럼 입력

```text
Root directory: /
Build command: pnpm build
Deploy command: npx wrangler deploy
```

6. 필요한 경우 환경 변수에 Node 버전을 지정

```text
NODE_VERSION=22
```

7. 저장 후 배포

Cloudflare Workers Builds는 대시보드에서 GitHub 저장소를 연결하면 Cloudflare가 빌드/배포 인증을 관리합니다. 그래서 별도의 GitHub Actions 토큰 설정 없이 `main` 브랜치 push로 자동 배포할 수 있습니다.

### 로컬에서 직접 배포

로컬에서 수동 배포하려면 Cloudflare에 로그인한 뒤 실행합니다.

```bash
pnpm exec wrangler login
pnpm deploy
```

배포 URL은 기본적으로 Workers 도메인입니다. `break-the-code.pages.dev`는 Cloudflare Pages 프로젝트 도메인이므로 이 Worker 배포와는 별도입니다. 그 도메인을 반드시 써야 한다면 Pages용 정적 배포로 구조를 바꾸거나, Workers에 커스텀 도메인을 연결하는 방식으로 운영해야 합니다.

## 참고 문서

- `PLAN.md`: 구현 계획과 AI 알고리즘 기준
- `AGENTS.md`: 후속 작업자가 지켜야 할 개발 원칙
- `DESIGN.md`: 디자인 방향과 화면 기준
