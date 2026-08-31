# Task Specification

## Task Shape

- **Shape**: `single-full`

## Goals

- Turn the Pi source-reading plan into a concrete, ordered learning workspace.
- Provide source maps and completed reference notes for SDK, Agent, Agent Loop, tools/events, context/session, and AgentHarness.
- Provide executable faux-provider labs and a minimal product-level harness without changing Pi core behavior.

## Non-Goals

- Do not fork or redesign Pi internals.
- Do not require paid providers, API keys, or network model calls.
- Do not exhaustively document every provider, TUI component, or extension hook.

## Constraints

- Follow repository `AGENTS.md` and use erasable TypeScript.
- Use faux providers and in-memory sessions for deterministic verification.
- Preserve existing source and examples; learning artifacts live in a dedicated directory.

## Environment

- **Project root**: `C:\Users\Administrator\Desktop\agent-lab\pi`
- **Language/runtime**: TypeScript / Node.js >= 22.19
- **Package manager**: npm workspaces
- **Test framework**: Vitest
- **Check command**: `npm run check`

## Deliverables

- `source-study/` workbook with ordered tasks and reference notes.
- Executable labs covering text, tools, errors, events, abort, context capture, session isolation, permissions, and skill filtering.
- A minimal `MyHarness` wrapper with tests and usage documentation.

## Done-When

- [ ] Every workbook stage names exact source files, symbols, tasks, output, and completion criteria.
- [ ] Labs run without API keys and assert the documented event/tool/context behavior.
- [ ] Minimal Harness supports policy, logging, custom prompt, skill filtering, and isolated sessions.
- [ ] Targeted tests and repository checks pass.

## Final Validation Command

```powershell
node node_modules/vitest/dist/cli.js --run --config packages/coding-agent/vitest.config.ts source-study/test/source-study.test.ts; npm run check
```

## Demo Flow

1. Open `source-study/README.md` and follow the numbered stages.
2. Run the source-study Vitest file to observe deterministic Agent behavior.
3. Run the minimal Harness demo and inspect emitted events.
