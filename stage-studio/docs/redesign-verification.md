# UI UX Pro Max redesign verification

Date: 2026-11-01 (Asia/Seoul).

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

## Production browser verification

- First redesign build `bf8d21c` deployed READY (`dpl_FZqEuQMxjTAxW57wqdnuVEdiAN7L`) and assigned the existing production URL.
- The signed-in 3-project library rendered actual project thumbnails and details. Search for `리허설` returned the expected single project; its menu exposed duplicate/delete actions. New-project dialog opened and cancelled at 375px without creating data.
- Final polish from production inspection: fixed mobile new-project action wrapping, aligned card footers, and strengthened form-control borders using the shared control token.
- Final production release: `5968f22`, deployment `dpl_J1gCiUhtvg1rjbUYBL5X18gPTpVq`, READY. Unique URL: https://stagecue-studio-b3sfhn56f-nnhs1.vercel.app ; alias: https://stagecue-studio.vercel.app . Framework: React/Vite. Vercel build duration: 6 seconds.
- At measured 375px the new-project action stayed on one line (105.25px wide, 48.8px tall), with no document overflow. At 1440px all three project cards measured 455.9px tall and their action footers shared the same top position. Actual thumbnail images loaded.
- Opened the cloud rehearsal project read-only and selected its lab scene. Preview and settings rendered, 28 scenes were present, and Save remained disabled (no unsaved changes). Browser warning/error log read returned an empty array.
- Production `/about` showed the new product preview and heading. Vercel error scan for the final deployment returned zero records in the last 10 minutes. This static-site runtime scan does not replace Supabase or browser checks.
- Screenshots saved locally under ignored `docs/qa/`: `redesign-library-mobile.png`, `redesign-library-desktop.png`, `redesign-editor-desktop.png`, `redesign-about-desktop.png`. Browser viewport override was reset after QA.
- No full security/accessibility audit, all-28-cue replay, cloud permanent deletion, or new OAuth configuration was performed for this visual change.
