# StageCue Studio · UI UX Pro Max redesign

## Scope and source

Requested source: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
Installed skill: `C:/Users/강준환/.codex/skills/ui-ux-pro-max/SKILL.md`.

The skill search matched a productivity SaaS product, product-demo/features composition, flat design, readable contrast, and keyboard focus guidance. The first editor query suggested a dark violet palette, and the narrower SaaS query suggested teal. Those palettes are deliberately overridden by the user's existing white background / blue accent preference. No search result is treated as authorization to change functionality.

## Direction

A calm, legible creative workspace. White surfaces, cool neutral canvas, strong cobalt actions, clear navy text. Larger real scene previews. Restrained borders, consistent radii, clear grouping, no gradients, decorative grids, glow, fake metrics, or invented controls.

## Shared tokens (defined globally)

- `--sc-blue: #2454e6`; `--sc-blue-hover: #1942bf`; `--sc-blue-soft: #edf2ff`.
- `--sc-ink: #17243c`; `--sc-text: #334155`; `--sc-muted: #5e6b80`.
- `--sc-canvas: #f4f6fa`; `--sc-surface: #ffffff`; `--sc-line: #dce3ee`.
- `--sc-danger: #b42335`; `--sc-success: #19704c`.
- Spacing 4, 8, 12, 16, 24, 32, 48, 64 px; radii 8/12/16 px.
- Body 16px public / 14px editor; labels at least 12px, normal text contrast >=4.5:1. Korean system sans, Latin same family. Avoid excessive negative letter spacing.
- Controls 44px where possible, >=44px for touch; visible focus ring, active/disabled/loading states, reduced-motion support.

## Page goals

- Public/auth: product-first preview, concise Korean copy, clear login/demo actions; preserve policy/contact content and real auth behavior.
- Library: roomy project gallery with actual scene thumbnails, readable titles/dates, edit/run/menu actions. Keep search, sort, creation, duplication and deletion behavior.
- Editor: purposeful three-column layout on wide screens; 240px scenes and ~300px inspector; large image center, readable note and audio cue below. Preserve every editing/preview/upload action. Responsive panels must remain operable.
- Controller: clear current cue and dominant next action, visibly separate emergency blackout, readable mixer, larger preview when sound desk is collapsed. Preserve all existing audio/channel behavior.
- Projection content, templates, timing, database and OAuth configuration are outside the visual redesign.

## Verification

Check local and production render, keyboard focus, responsive reflow, scene navigation, editing/save, audio controls, and separate stage connection without overwriting existing cloud projects. Record measured viewport rather than assuming requested overrides applied.
