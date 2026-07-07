# ScheduleSpark Time Picker

Framework-free analog and digital time picker for ScheduleSpark forms.

## Screenshots

Only the labeled input shows by default; the picker opens as an anchored popover on focus.
Screenshots below show the popover open, in each mode.

### Analog

![Analog time picker popover open, showing AM/PM controls and hour/minute clock faces](https://cdn.jsdelivr.net/npm/@schedulespark/time-picker/docs/screenshots/analog.jpg)

### Digital

![Digital time picker popover open, showing a scrollable list of time options](https://cdn.jsdelivr.net/npm/@schedulespark/time-picker/docs/screenshots/digital.jpg)

## Usage

```ts
import { createTimePicker } from "@schedulespark/time-picker";
import "@schedulespark/time-picker/styles.css";

const picker = createTimePicker({
  label: "Start time",
  value: "09:00",
  minTime: "06:00",
  maxTime: "18:00",
  minuteStep: 15,
  mode: "analog",
  onChange: (value) => {
    console.log(value); // HH:mm
  }
});

picker.mount(document.querySelector("#time-picker"));
```

## Theming

Every visual value is a CSS custom property on `.ssp-time-picker`, each falling back to the
default shown below. Override any subset in your own stylesheet — no JavaScript configuration
needed.

| Variable | Default | Affects |
|---|---|---|
| `--ssp-time-picker-text` | `#18211f` | Root text, button text |
| `--ssp-time-picker-label-text` | `#33413d` | Field label |
| `--ssp-time-picker-border` | `#c7d1cc` / `#d8e0dc` | Input, button, popover, and clock-face borders |
| `--ssp-time-picker-bg` | `#fff` | Button, popover, and clock-face backgrounds |
| `--ssp-time-picker-accent` | `#11735f` | Focus ring, active/selected border, clock-center dot |
| `--ssp-time-picker-accent-bg` | `#dff4eb` | Active/selected button background |
| `--ssp-time-picker-accent-text` | `#0a4f42` | Active/selected button text |
| `--ssp-time-picker-disabled-bg` | `#eef2f0` | Disabled button background |
| `--ssp-time-picker-disabled-text` | `#8a9692` | Disabled button text |
| `--ssp-time-picker-radius` | `0.5rem` | Popover corner radius |
| `--ssp-time-picker-popover-shadow` | `0 12px 24px -12px rgb(10 30 25 / 25%), 0 2px 8px rgb(10 30 25 / 10%)` | Popover drop shadow |
| `--ssp-time-picker-z-index` | `20` | Popover stacking order — raise this if the picker opens inside a modal or drawer with a higher stacking context |
| `--ssp-time-picker-popover-min-width` | `16rem` | Popover minimum width |
| `--ssp-time-picker-popover-max-width` | `min(94vw, 22rem)` | Popover maximum width |
| `--ssp-time-picker-clock-size` | `min(17rem, 78vw)` | Analog hour clock-face size |

### Dark mode example

```css
.my-dark-page .ssp-time-picker {
  --ssp-time-picker-text: #e7f1ee;
  --ssp-time-picker-label-text: #b7c4bf;
  --ssp-time-picker-border: #33413d;
  --ssp-time-picker-bg: #17211e;
  --ssp-time-picker-accent: #4fd1a5;
  --ssp-time-picker-accent-bg: #163a2f;
  --ssp-time-picker-accent-text: #8ff0c7;
  --ssp-time-picker-disabled-bg: #1f2926;
  --ssp-time-picker-disabled-text: #5b6b66;
}
```

## API

`createTimePicker(options)` returns:

- `mount(host)` renders the picker inside an element.
- `setValue(value)` updates the picker value.
- `setDisabled(disabled)` toggles disabled state.
- `destroy()` removes the picker DOM.

Options:

- `value`: current time as `HH:mm`.
- `onChange`: receives normalized `HH:mm`.
- `mode`: `"analog"` or `"digital"`.
- `timeFormat`: `"24h"` or `"12h"` display mode, default `"24h"`.
- `minuteStep`: digital option step, default `15`.
- `minTime`: lowest selectable value, inclusive.
- `maxTime`: highest selectable value, inclusive.
- `label`, `id`, `name`, `placeholder`, `required`, `disabled`.

## Range Rules

The picker only accepts valid day times from `00:00` to `23:59`.

`timeFormat` only changes display labels. Values, `minTime`, `maxTime`, and `onChange` always use normalized `HH:mm`; for example, `23:59` displays as `11:59 PM` in 12-hour mode. Use `maxTime: "11:59"` for 11:59 AM, or `maxTime: "23:59"` for 11:59 PM.

`minTime` and `maxTime` restrict a specific picker instance:

- Typed values are normalized to `HH:mm` and clamped to the allowed range.
- Digital values outside the range stay visible but are disabled.
- Analog hour and minute values outside the range are disabled.
