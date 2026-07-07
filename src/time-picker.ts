/* eslint-disable jsdoc/require-jsdoc, max-lines -- Private DOM builders stay in one file so the vanilla widget structure is easy to follow. */
import {
  addMinutesToTime,
  formatMinutesAsDisplayTime,
  formatMinutesAsTime,
  generateTimeOptions,
  isTimeInRange,
  normalizeTime,
  parseTimeToMinutes
} from "./utils/time-utils";

import type { TimePickerInstance, TimePickerMode, TimePickerOptions } from "./types";

interface PickerState {
  disabled: boolean;
  mode: TimePickerMode;
  open: boolean;
  value: string;
}

interface ClockButtonOptions {
  disabled: boolean;
  index: number;
  label: string;
  selected: boolean;
  total: number;
}

interface PeriodButtonOptions {
  active: boolean;
  disabled: boolean;
  period: "AM" | "PM";
  selected: SelectedTime;
  commit: (value: string) => void;
}

interface SelectedTime {
  hour: number;
  minute: number;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const TWELVE_HOUR_LABELS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/**
 * Creates a framework-free analog and digital time picker.
 *
 * The root, label, input, and popover container are built once on mount and never
 * replaced afterward. Only the popover's own contents (mode controls, analog/digital
 * panels) are rebuilt in place when state that affects them changes (mode, value,
 * disabled). This matters: replacing the `<input>` element itself on every keystroke
 * or focus event would strand the user's typing/focus on a now-detached node.
 */
// eslint-disable-next-line max-lines-per-function -- Closure state (host/input/popover/state) and its mutators must stay colocated; splitting would just pass all five around as parameters.
export function createTimePicker(options: TimePickerOptions = {}): TimePickerInstance {
  let host: HTMLElement | null = null;
  let input: HTMLInputElement | null = null;
  let popover: HTMLElement | null = null;
  let state: PickerState = {
    disabled: options.disabled ?? false,
    mode: options.mode ?? "analog",
    open: false,
    value: normalizeTime(options.value ?? "", options.minTime, options.maxTime) ?? ""
  };

  // Single mutation point for `state`, so the "never open while disabled" invariant is
  // enforced in exactly one place instead of relying on every call site to remember it.
  const setState = (patch: Partial<PickerState>): void => {
    const next = { ...state, ...patch };
    state = { ...next, open: next.disabled ? false : next.open };
  };

  const refreshPopoverContent = (): void => {
    if (popover === null) return;
    const panels = element("div", "ssp-time-picker__panels");
    panels.append(buildAnalogView(options, state, commitSelection), buildDigitalView(options, state, commitSelection));
    popover.replaceChildren(buildModeControls(state, setMode), panels);
  };

  const setDisplayedValue = (value: string): void => {
    if (input === null) return;
    const minutes = value === "" ? null : parseTimeToMinutes(value);
    input.value = minutes === null ? value : formatMinutesAsDisplayTime(minutes, options.timeFormat);
  };

  /** Normalizes, stores, and reports a value; used by every commit path below. */
  const applyValue = (normalized: string): void => {
    setState({ value: normalized });
    setDisplayedValue(normalized);
    options.onChange?.(normalized);
  };

  /** Commits an actual time selection (analog/digital/period click) — always closes the popover. */
  const commitSelection = (nextValue: string): void => {
    const normalized = normalizeTime(nextValue, options.minTime, options.maxTime);
    if (normalized === null) return;
    applyValue(normalized);
    setState({ open: false });
    if (popover !== null) popover.hidden = true;
    refreshPopoverContent();
  };

  /**
   * Commits the input's typed text (blur/Enter) and closes the popover, matching selection
   * commit. Unparseable text is rejected rather than silently accepted or left dangling: the
   * input reverts to the last valid value instead of leaving the DOM showing text that was
   * never actually committed to `state`/`onChange`.
   */
  const commitTyped = (nextValue: string): void => {
    const normalized = normalizeTime(nextValue, options.minTime, options.maxTime);
    if (normalized === null) {
      setDisplayedValue(state.value);
    } else {
      applyValue(normalized);
    }
    setState({ open: false });
    if (popover !== null) popover.hidden = true;
    refreshPopoverContent();
  };

  /** Applies an arrow-key nudge without closing the popover — the user is still adjusting. */
  const adjustValue = (nextValue: string): void => {
    const normalized = normalizeTime(nextValue, options.minTime, options.maxTime);
    if (normalized === null) return;
    applyValue(normalized);
    refreshPopoverContent();
  };

  const setMode = (mode: TimePickerMode): void => {
    setState({ mode });
    refreshPopoverContent();
  };

  const openPopover = (): void => {
    if (state.disabled || state.open) return;
    setState({ open: true });
    refreshPopoverContent();
    if (popover !== null) popover.hidden = false;
  };

  const closePopover = (): void => {
    if (!state.open) return;
    setState({ open: false });
    if (popover !== null) popover.hidden = true;
  };

  const handleDocumentPointerDown = (event: PointerEvent): void => {
    if (host === null) return;
    if (event.target instanceof Node && host.contains(event.target)) return;
    closePopover();
  };

  return {
    destroy: () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
      host?.replaceChildren();
      host = null;
      input = null;
      popover = null;
    },
    mount: (nextHost: HTMLElement) => {
      host = nextHost;
      const built = buildPicker(options, state, commitTyped, adjustValue, openPopover, closePopover);
      input = built.input;
      popover = built.popover;
      host.replaceChildren(built.root);
      refreshPopoverContent();
      document.addEventListener("pointerdown", handleDocumentPointerDown);
    },
    setDisabled: (disabled: boolean) => {
      setState({ disabled });
      if (input !== null) input.disabled = disabled;
      if (popover !== null) popover.hidden = !state.open;
      refreshPopoverContent();
    },
    setValue: (value: string) => {
      const normalized = normalizeTime(value, options.minTime, options.maxTime);
      // An unparseable external value is rejected, not applied as an empty field — a caller
      // passing bad data shouldn't silently blank out whatever the picker already held.
      if (normalized === null) return;
      setState({ value: normalized });
      setDisplayedValue(normalized);
      refreshPopoverContent();
    }
  };
}

interface BuiltPicker {
  input: HTMLInputElement;
  popover: HTMLElement;
  root: HTMLElement;
}

/**
 * Builds the root/label/input/popover-container shell once, at mount time. The
 * popover's actual contents (mode controls, analog/digital panels) are populated
 * separately by `refreshPopoverContent`, since those need to be rebuilt whenever
 * mode/value/disabled state changes without touching this shell.
 */
// eslint-disable-next-line max-params -- Wires the input's popover-open/close hooks alongside its commit paths.
function buildPicker(
  options: TimePickerOptions,
  state: PickerState,
  commitTyped: (value: string) => void,
  adjustValue: (value: string) => void,
  openPopover: () => void,
  closePopover: () => void
): BuiltPicker {
  const root = element("div", "ssp-time-picker");
  const inputId = resolveInputId(options);
  const label = buildLabel(options, inputId);
  const input = buildInput(options, state, commitTyped, adjustValue, inputId, openPopover, closePopover);
  const popover = element("div", "ssp-time-picker__popover");

  popover.hidden = !state.open;
  // Prevents any button inside the popover from stealing focus away from the input on
  // click. Without this, clicking a mode-toggle/clock/digital-time button would blur the
  // input first (native focus-shift behavior), which would immediately close the popover
  // via the input's own blur handler — snapping it shut before the button's own click
  // handler (setMode/commit) ever runs. Selections still close the popover themselves,
  // through commitSelection.
  popover.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });
  root.append(label, input, popover);

  return { input, popover, root };
}

function buildLabel(options: TimePickerOptions, inputId: string): HTMLElement {
  const label = element("label", "ssp-time-picker__label");
  label.textContent = options.label ?? "Time";
  label.setAttribute("for", inputId);
  return label;
}

// eslint-disable-next-line max-params -- Wires the input's popover-open/close hooks alongside its commit paths.
function buildInput(
  options: TimePickerOptions,
  state: PickerState,
  commitTyped: (value: string) => void,
  adjustValue: (value: string) => void,
  inputId: string,
  openPopover: () => void,
  closePopover: () => void
): HTMLInputElement {
  const input = document.createElement("input");
  const minutes = state.value === "" ? null : parseTimeToMinutes(state.value);
  input.className = "ssp-time-picker__input";
  input.disabled = state.disabled;
  input.id = inputId;
  input.name = options.name ?? "";
  input.placeholder = options.placeholder ?? (options.timeFormat === "12h" ? "h:mm AM" : "HH:mm");
  input.required = options.required ?? false;
  input.type = "text";
  input.value = minutes === null ? state.value : formatMinutesAsDisplayTime(minutes, options.timeFormat);
  input.addEventListener("focus", () => {
    openPopover();
  });
  // A selection or blur-commit closes the popover without ever blurring the input (the
  // popover's own mousedown handler prevents that). So re-clicking the still-focused input
  // fires no further `focus` event — without this, the popover could only be reopened by
  // tabbing away and back. `openPopover` no-ops if it's already open, so this is safe to
  // call unconditionally on every click.
  input.addEventListener("click", () => {
    openPopover();
  });
  input.addEventListener("blur", () => {
    commitTyped(input.value);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePopover();
      return;
    }
    handleInputKeydown(event, input, options, adjustValue);
  });
  return input;
}

function resolveInputId(options: TimePickerOptions): string {
  const source = options.id ?? options.name ?? options.label ?? "time";
  return `ssp-time-picker-${source.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function handleInputKeydown(
  event: KeyboardEvent,
  input: HTMLInputElement,
  options: TimePickerOptions,
  commit: (value: string) => void
): void {
  const step = options.minuteStep ?? 15;
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

  event.preventDefault();
  const direction = event.key === "ArrowUp" ? step : -step;
  const next = addMinutesToTime(input.value, direction, options.minTime, options.maxTime);
  if (next !== null) commit(next);
}

function buildModeControls(state: PickerState, setMode: (mode: TimePickerMode) => void): HTMLElement {
  const controls = element("div", "ssp-time-picker__modes");
  controls.append(buildModeButton("analog", state, setMode), buildModeButton("digital", state, setMode));
  return controls;
}

function buildModeButton(mode: TimePickerMode, state: PickerState, setMode: (mode: TimePickerMode) => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "ssp-time-picker__mode";
  button.dataset.active = String(state.mode === mode);
  button.textContent = mode === "analog" ? "Analog" : "Digital";
  button.type = "button";
  button.addEventListener("click", () => {
    setMode(mode);
  });
  return button;
}

function buildAnalogView(options: TimePickerOptions, state: PickerState, commit: (value: string) => void): HTMLElement {
  const view = element("div", "ssp-time-picker__analog");
  const selected = state.value === "" ? "00:00" : state.value;
  const [selectedHour, selectedMinute] = selected.split(":").map(Number);

  view.dataset.view = "analog";
  view.hidden = state.mode !== "analog";
  view.append(
    buildPeriodControls(options, selectedHour, selectedMinute, commit),
    buildHourGrid(options, selectedHour, selectedMinute, commit),
    buildMinuteGrid(options, selectedHour, selectedMinute, commit)
  );
  return view;
}

function buildHourGrid(
  options: TimePickerOptions,
  selectedHour: number,
  selectedMinute: number,
  commit: (value: string) => void
): HTMLElement {
  const grid = buildClockFace("ssp-time-picker__clock-face ssp-time-picker__clock-face--hours");
  const hours = options.timeFormat === "12h" ? TWELVE_HOUR_LABELS : HOURS;
  hours.forEach((hour, index) => {
    const normalizedHour = options.timeFormat === "12h" ? toTwentyFourHour(hour, selectedHour) : hour;
    const disabled = !doesHourIntersectRange(hour, options);
    const selected = options.timeFormat === "12h" ? toTwelveHour(selectedHour) === hour : selectedHour === hour;
    const label = options.timeFormat === "12h" ? String(hour) : String(hour).padStart(2, "0");
    const button = clockButton({ disabled, index, label, selected, total: hours.length });
    button.dataset.hour = String(normalizedHour);
    button.addEventListener("click", () => {
      commit(`${String(normalizedHour).padStart(2, "0")}:${String(selectedMinute).padStart(2, "0")}`);
    });
    grid.append(button);
  });
  return grid;
}

function buildMinuteGrid(
  options: TimePickerOptions,
  selectedHour: number,
  selectedMinute: number,
  commit: (value: string) => void
): HTMLElement {
  const minutes = [0, 15, 30, 45];
  const grid = buildClockFace("ssp-time-picker__clock-face ssp-time-picker__clock-face--minutes");
  minutes.forEach((minute, index) => {
    const time = formatMinutesAsTime((selectedHour * 60) + minute);
    const disabled = !isTimeInRange(time, options.minTime, options.maxTime);
    const button = clockButton({
      disabled,
      index,
      label: String(minute).padStart(2, "0"),
      selected: selectedMinute === minute,
      total: minutes.length
    });
    button.dataset.minute = String(minute);
    button.addEventListener("click", () => {
      commit(time);
    });
    grid.append(button);
  });
  return grid;
}

function buildDigitalView(options: TimePickerOptions, state: PickerState, commit: (value: string) => void): HTMLElement {
  const view = element("div", "ssp-time-picker__digital");
  view.dataset.view = "digital";
  view.hidden = state.mode !== "digital";
  generateTimeOptions({ minuteStep: options.minuteStep }).forEach((time) => {
    const disabled = !isTimeInRange(time, options.minTime, options.maxTime);
    const button = document.createElement("button");
    button.className = "ssp-time-picker__time-option";
    button.dataset.timeValue = time;
    button.disabled = disabled;
    button.type = "button";
    button.textContent = formatDigitalLabel(time, options);
    button.addEventListener("click", () => {
      commit(time);
    });
    view.append(button);
  });
  return view;
}

function buildPeriodControls(
  options: TimePickerOptions,
  selectedHour: number,
  selectedMinute: number,
  commit: (value: string) => void
): HTMLElement {
  const controls = element("div", "ssp-time-picker__periods");
  if (options.timeFormat !== "12h") return controls;

  controls.append(
    periodButton(buildPeriodButtonOptions("AM", options, { hour: selectedHour, minute: selectedMinute }, commit)),
    periodButton(buildPeriodButtonOptions("PM", options, { hour: selectedHour, minute: selectedMinute }, commit))
  );
  return controls;
}

function buildPeriodButtonOptions(
  period: "AM" | "PM",
  options: TimePickerOptions,
  selected: SelectedTime,
  commit: (value: string) => void
): PeriodButtonOptions {
  const hour = period === "AM" ? selected.hour % 12 : (selected.hour % 12) + 12;
  const time = formatMinutesAsTime((hour * 60) + selected.minute);
  return {
    active: period === "AM" ? selected.hour < 12 : selected.hour >= 12,
    commit,
    disabled: !isTimeInRange(time, options.minTime, options.maxTime),
    period,
    selected
  };
}

function periodButton({
  active,
  commit,
  disabled,
  period,
  selected
}: PeriodButtonOptions): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "ssp-time-picker__period";
  button.dataset.active = String(active);
  button.dataset.period = period;
  button.disabled = disabled;
  button.textContent = period;
  button.type = "button";
  button.addEventListener("click", () => {
    const hour = period === "AM" ? selected.hour % 12 : (selected.hour % 12) + 12;
    commit(formatMinutesAsTime((hour * 60) + selected.minute));
  });
  return button;
}

function clockButton({ disabled, index, label, selected, total }: ClockButtonOptions): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "ssp-time-picker__clock-button";
  button.dataset.selected = String(selected);
  button.disabled = disabled;
  button.textContent = label;
  button.type = "button";
  positionClockButton(button, index, total);
  return button;
}

function buildClockFace(className: string): HTMLElement {
  const face = element("div", className);
  const center = element("div", "ssp-time-picker__clock-center");
  face.append(center);
  return face;
}

function positionClockButton(button: HTMLButtonElement, index: number, total: number): void {
  const angle = ((index / total) * 360) - 90;
  const radians = (angle * Math.PI) / 180;
  const radius = 43;
  const x = 50 + (radius * Math.cos(radians));
  const y = 50 + (radius * Math.sin(radians));
  button.style.left = `${x.toFixed(2)}%`;
  button.style.top = `${y.toFixed(2)}%`;
}

function doesHourIntersectRange(hour: number, options: TimePickerOptions): boolean {
  if (options.timeFormat === "12h") {
    const amHour = hour === 12 ? 0 : hour;
    const pmHour = hour === 12 ? 12 : hour + 12;
    return doesTwentyFourHourIntersectRange(amHour, options) || doesTwentyFourHourIntersectRange(pmHour, options);
  }
  return doesTwentyFourHourIntersectRange(hour, options);
}

function doesTwentyFourHourIntersectRange(hour: number, options: TimePickerOptions): boolean {
  const start = formatMinutesAsTime(hour * 60);
  const end = formatMinutesAsTime((hour * 60) + 59);
  return isTimeInRange(start, options.minTime, options.maxTime) || isTimeInRange(end, options.minTime, options.maxTime);
}

function toTwelveHour(hour: number): number {
  return hour % 12 === 0 ? 12 : hour % 12;
}

function toTwentyFourHour(hour: number, selectedHour: number): number {
  if (selectedHour < 12) return hour === 12 ? 0 : hour;
  return hour === 12 ? 12 : hour + 12;
}

function formatDigitalLabel(time: string, options: TimePickerOptions): string {
  const minutes = parseTimeToMinutes(time);
  return minutes === null ? time : formatMinutesAsDisplayTime(minutes, options.timeFormat);
}

function element(tagName: "div" | "label", className: string): HTMLElement {
  const node = document.createElement(tagName);
  node.className = className;
  return node;
}
