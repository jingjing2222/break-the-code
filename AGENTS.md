# AGENTS.md

## Project Goal
- Build a mobile-first responsive Break the Code web app for human vs computer 2-player play.
- Treat `PLAN.md` as the implementation source of truth and `DESIGN.md` as the visual source of truth.
- Replace the existing conference starter experience with the playable game experience.

## Non-Negotiable Implementation Rules
- Use Playwright while building and verify both mobile and desktop flows.
- Prefer proven libraries where they materially reduce custom logic, but keep the core candidate filtering engine small and explicit because the search space is only up to `15C5 = 3003`.
- Do not create separate "dumb" AI implementations per difficulty. Build one candidate filtering AI engine and vary difficulty through configuration only.
- Never pass hidden truth into the AI. The computer player may know only `myCode`, `candidates`, and `difficulty`.
- Do not store `humanActualCode`, hidden deck state, face-down question cards, or other unavailable information inside the AI object.
- Use TypeScript inference by default. Declare public/domain boundary types, but avoid redundant local annotations when inference, `as const`, or `satisfies` is enough.

## Game Rules And AI Requirements
- v1 is 2-player human vs computer.
- Each player receives 5 sorted tiles.
- Tile sorting is number ascending, then color rank `R -> B -> G`.
- The visible answer key is `color + number`; physical tile `id` is only for internal tile identity.
- AI starts with all possible opponent-code candidates made from tiles excluding its own code.
- Every observed answer filters the AI candidate set unless difficulty drops the clue.
- If the visible candidate group is unique, AI can safely guess.
- Beginner and intermediate may guess earlier according to configured confidence.
- Advanced and expert should avoid shared-info cards that leak unusually strong information about their own code.

## UI And Design Requirements
- Route `/game` is the playable game. Route `/` is only an entry screen.
- Follow the WIRED-inspired editorial style from `DESIGN.md`: paper white, black rules, square corners, no shadows, no gradients, no decorative rounded cards.
- Mobile layout comes first: game header, opponent tiles, own tiles, turn ribbon, six visible question cards, and bottom action area.
- Completed game results must be persisted in localStorage and surfaced on `/history`, not inside the active game workspace.
- Desktop can expand into an editorial 3-column layout for board, actions, and deduction/log panels.
- Use existing `lucide-react` icons for UI affordances.

## Verification
- Add and run unit tests for tile generation, sorting, candidate generation, question answering, candidate filtering, guessing, and AI fairness.
- Add and run Playwright tests for mobile flow, desktop layout, AI turn update, and guess success/failure.
- Final verification should include `pnpm test`, `pnpm check`, `pnpm build`, and `pnpm exec playwright test`.
