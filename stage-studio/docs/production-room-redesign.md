# Production-room redesign, 2026-11-04

References: https://github.com/Leonxlnx/taste-skill and https://github.com/nextlevelbuilder/ui-ux-pro-max-skill . Read local installed skill guidance and current upstream taste-skill overview. UI UX Pro Max creative-production query provided creative/minimal composition and contrast guidance; its black/white palette was adapted to stage-room charcoal, off-white and lime. Native CSS keeps existing React/Vite dependencies.

Design read: a production room for school theater operators. Variance 7, motion 3, density 4. Large public typography and real template imagery; dark editing and performance surfaces; light project gallery. Existing assets, routes, authentication, data and cue behavior remain.

Implementation: src/art-direction.css is the explicit visual-system layer imported after base component styles. Public layout rebuilt as full-width heading/argument and dominant real app preview; gallery uses two large columns; editor and controller use low-light stage-room surfaces. Reduced motion inherited. No new external media or fonts.

Verification: production build and diff check passed. Local browser inspected about/editor/controller; selected lab scene and opened performance control. At measured 375px controller collapse worked with no document horizontal overflow. No cloud writes. Full all-cue playback and complete accessibility audit not repeated. Current upstream v2 draw/inspector workflow was not run; manual browser review used with installed skill guidance.
