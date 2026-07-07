# Changelog

All notable changes to `@schedulespark/time-picker` are documented here.

This project follows a pre-1.0 beta release model. Until `1.0.0`, minor and patch beta releases may include API adjustments. Version changes must be approved as explicit release decisions before publishing.

## 0.0.1-beta-3-0-0

- README screenshots now load from the published npm package via jsDelivr instead of relative paths, so they render correctly on the npm package page.
- README screenshots switched from PNG to higher-fidelity JPG assets for npm/jsDelivr rendering.

## 0.0.1-beta-2-0-0

- Added a framework-free analog and digital time picker package.
- Added selectable min and max time restrictions with disabled out-of-range analog and digital values.
- Added 12-hour and 24-hour display modes while keeping values normalized as `HH:mm`.
- Added README screenshots and package release documentation.
- Converted to an anchored popover: only the input shows by default, opening on focus/click and closing on Escape, outside click, or a committed selection.
- Added CSS custom-property theming (colors, popover z-index/radius/shadow, responsive sizing bounds), documented in the README's Theming section.
- Rejects unparseable typed/`setValue` input instead of silently discarding it; the input reverts to the last valid value rather than showing text that was never committed.

## Release Notes Process

For each future release:

1. Add an entry above the previous release.
2. Summarize user-facing changes, API changes, fixes, and migration notes.
3. Link relevant Linear issues or pull requests when available.
4. Confirm the package version separately before publishing.
