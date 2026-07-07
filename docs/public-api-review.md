# Public API Review

This review records the current public surface of `@schedulespark/time-picker` before npm publishing.

## Package Entrypoints

- `@schedulespark/time-picker`
  - `createTimePicker(options)` framework-free DOM renderer.
  - Public TypeScript types for picker options, instance methods, modes, and time format.
- `@schedulespark/time-picker/styles.css`
  - Required stylesheet for analog and digital picker rendering.

## Stability Notes

- The package is beta. APIs may change before `1.0.0`.
- Values emitted by `onChange` are always normalized `HH:mm`.
- `timeFormat` changes display labels only; range values stay canonical `HH:mm`.
- The picker owns only its local DOM and does not persist data internally.
- Consumers remain responsible for mounting, unmounting, and storing selected values.

## Reviewed Export Areas

- Analog clock face mode.
- Digital stepped option list mode.
- Input parsing and normalization.
- Min and max time restrictions.
- 12-hour and 24-hour display formatting.
- Instance lifecycle methods: `mount`, `setValue`, `setDisabled`, and `destroy`.

## Before Removing Beta Status

- Confirm keyboard behavior and accessibility labels are final.
- Confirm minute granularity requirements beyond 15-minute analog selections.
- Confirm theming hooks and CSS class names are stable.
