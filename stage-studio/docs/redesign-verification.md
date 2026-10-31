# UI UX Pro Max redesign verification

Date: 2026-10-31 (Asia/Seoul).

## Change boundaries

- Installed and applied `nextlevelbuilder/ui-ux-pro-max-skill` to public/auth, library, editor and controller screens.
- Shared white/cobalt palette follows the user's preference; layout, typography, contrast, focus and responsive guidance follow the skill. See `redesign-brief.md` and `design-system/stagecue-studio/MASTER.md`.
- Auth handlers and policy/terms content were compared against the previous commit and preserved. Editor change is a current-scene heading. Controller logic before its render return is unchanged; event handlers, audio settings and StageCanvas props are preserved.
- No database, OAuth, audio engine, channel, projector canvas, original backdrop site or template asset changes.

## Local verification

- `npm.cmd run build`: TypeScript and Vite production build passed.
- `git diff --check`: passed.
- Key normal-text contrast ratios: muted/white 5.40, muted/canvas 4.99, blue/white 6.02. These are token checks, not a claim of a complete WCAG audit.
- Browser measured widths: 375, 720, 768, 1024 and 1440 CSS pixels. Public/auth at 375; editor at 375/720/768/1024/1440; controller at 375/1024. No page-level horizontal overflow in the inspected layouts. Internal scene rails intentionally scroll.
- At 1440 the editor columns measured 240 / 896 / 304px. At 768/1024 settings reflow below the canvas; at 720 the editor uses a full-height document flow. A keyboard Tab into the audio-cue select showed a solid focus outline and scrolled the control fully into view.
- Guest template: 28 scenes and 6 tracks rendered; scene selection and audio inspector worked. Edited scene 3's note, saved, reloaded, selected scene 3 and confirmed persistence; restored and saved the original note.
- Controller next action advanced to cue 2 and reported vocal music playing; next cue showed the lab and reported sound stopped after its fade. Manual Route 216 playback reported playing/repeating. Mixer collapse/expand and master-volume keyboard controls worked; original 75% live master setting restored. Tests ran muted.
- Separate stage popup produced the controller's `공연 화면 연결됨` acknowledgement. The popup was not enumerated as a separate IAB tab; full projector pixel comparison and all-cue playback were not repeated for this CSS/markup change.
- Before deployment, existing production Google sign-in returned to the actual 3-project library. No cloud project was edited or deleted.

## Release target

- Linked project: `nnhs1/stagecue-studio`, `prj_uH0oKEftV7v4OAsoNyfnltkrBE4E`.
- CLI `project inspect --non-interactive --scope nnhs1` confirmed the exact owner/project.
- Vercel MCP returned 404 for that ID/team; the already authenticated CLI is the fallback.
- Production URL: https://stagecue-studio.vercel.app

Production deployment and browser results will be added after release.
