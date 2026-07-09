/* eslint-disable jsdoc/require-jsdoc, max-lines -- Private DOM builders stay in one file so the vanilla widget structure is easy to follow. */
import {
  addMinutesToTime,
  formatMinutesAsDisplayTime,
  formatMinutesAsTime,
  generateTimeOptions,
  isTimeInRange,
  normalizeMinuteStep,
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

interface ClockLabelOptions {
  disabled: boolean;
  index: number;
  label: string;
  radius?: number;
  selected: boolean;
  total: number;
  value: number;
  valueType: "hour" | "minute";
  onSelect: (value: number) => void;
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

interface AnalogCallbacks {
  adjust: (value: string) => void;
  commit: (value: string) => void;
  dragUpdate: (value: string) => void;
}

interface AnalogGridOptions {
  callbacks: AnalogCallbacks;
  options: TimePickerOptions;
  selectedHour: number;
  selectedMinute: number;
}

interface ResolveHourFromClockPositionOptions {
  distance: number;
  hourCarry: number;
  hourIndex: number;
  options: TimePickerOptions;
  selectedHour: number;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const TWELVE_HOUR_LABELS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const POPOVER_VIEWPORT_MARGIN = 8;
const SVG_NS = "http://www.w3.org/2000/svg";
const CLOCK_CENTER = 50;
const OUTER_CLOCK_RADIUS = 43;
const INNER_CLOCK_RADIUS = 28;

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
    panels.append(
      buildAnalogView(options, state, { adjust: adjustValue, commit: commitSelection, dragUpdate: dragUpdateValue }),
      buildDigitalView(options, state, commitSelection)
    );
    popover.replaceChildren(buildModeControls(state, setMode), panels);
    updatePopoverPlacement();
  };

  /**
   * Updates the hand rotation and live value readout in place, without rebuilding the
   * popover — used for continuous pointer-drag updates (see `dragUpdateValue` below).
   * A full `refreshPopoverContent` rebuild mid-drag would destroy the SVG grid element the
   * browser's native pointermove/pointerup events are still targeting (no pointer capture
   * is used), silently ending the drag after its first tick. Only a completed drag (commit,
   * on pointerup) or a discrete click (AM/PM, digital option, keyboard nudge) rebuilds.
   */
  const updateDragVisuals = (value: string): void => {
    if (popover === null) return;
    const [hour, minute] = value.split(":").map(Number);
    const hand = popover.querySelector<SVGLineElement>(".ssp-time-picker__clock-hand");
    if (hand !== null) {
      const position = clockPosition((hour % 12) + (minute / 60), 12, OUTER_CLOCK_RADIUS - 8);
      hand.setAttribute("x2", position.x.toFixed(2));
      hand.setAttribute("y2", position.y.toFixed(2));
    }
    const valueDisplay = popover.querySelector(".ssp-time-picker__analog-value");
    if (valueDisplay !== null) valueDisplay.textContent = value;
  };

  /** Applies a value during an in-progress drag: updates state/input/onChange and the
   *  live visuals, but deliberately skips `refreshPopoverContent` (see its comment above). */
  const dragUpdateValue = (nextValue: string): void => {
    const normalized = normalizeTime(nextValue, options.minTime, options.maxTime);
    if (normalized === null) return;
    applyValue(normalized);
    updateDragVisuals(normalized);
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
    if (popover !== null) {
      popover.hidden = false;
      updatePopoverPlacement();
    }
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

  const updatePopoverPlacement = (): void => {
    if (input === null || popover === null || popover.hidden) return;
    placePopoverWithinViewport(input, popover);
  };

  const handleWindowResize = (): void => {
    updatePopoverPlacement();
  };

  return {
    destroy: () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
      window.removeEventListener("resize", handleWindowResize);
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
      window.addEventListener("resize", handleWindowResize);
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

function placePopoverWithinViewport(input: HTMLInputElement, popover: HTMLElement): void {
  popover.dataset.align = "start";

  const inputRect = input.getBoundingClientRect();
  const popoverRect = popover.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const wouldOverflowRight = inputRect.left + popoverRect.width > viewportWidth - POPOVER_VIEWPORT_MARGIN;
  const fitsWhenRightAligned = inputRect.right - popoverRect.width >= POPOVER_VIEWPORT_MARGIN;

  if (wouldOverflowRight && fitsWhenRightAligned) {
    popover.dataset.align = "end";
  }
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
  button.setAttribute("aria-label", mode === "analog" ? "Analog" : "Digital");
  button.type = "button";
  button.append(mode === "analog" ? buildAnalogModeIcon() : buildDigitalModeIcon());
  button.addEventListener("click", () => {
    setMode(mode);
  });
  return button;
}

/** A simple clock-face glyph (ring + hour/minute hands) for the analog mode toggle. */
function buildAnalogModeIcon(): SVGSVGElement {
  const icon = modeIconSvg();
  const face = svgElement("circle");
  face.setAttribute("cx", "12");
  face.setAttribute("cy", "12");
  face.setAttribute("r", "8.5");
  const hourHand = svgElement("line");
  hourHand.setAttribute("x1", "12");
  hourHand.setAttribute("y1", "12");
  hourHand.setAttribute("x2", "12");
  hourHand.setAttribute("y2", "7.5");
  const minuteHand = svgElement("line");
  minuteHand.setAttribute("x1", "12");
  minuteHand.setAttribute("y1", "12");
  minuteHand.setAttribute("x2", "15.25");
  minuteHand.setAttribute("y2", "12");
  icon.append(face, hourHand, minuteHand);
  return icon;
}

/** A rounded-rectangle "display" glyph with a colon, for the digital mode toggle. */
function buildDigitalModeIcon(): SVGSVGElement {
  const icon = modeIconSvg();
  const screen = svgElement("rect");
  screen.setAttribute("x", "3.5");
  screen.setAttribute("y", "6");
  screen.setAttribute("width", "17");
  screen.setAttribute("height", "12");
  screen.setAttribute("rx", "2");
  const colonTop = svgElement("circle");
  colonTop.setAttribute("cx", "12");
  colonTop.setAttribute("cy", "10.25");
  colonTop.setAttribute("r", "0.75");
  colonTop.setAttribute("fill", "currentColor");
  colonTop.setAttribute("stroke", "none");
  const colonBottom = svgElement("circle");
  colonBottom.setAttribute("cx", "12");
  colonBottom.setAttribute("cy", "13.75");
  colonBottom.setAttribute("r", "0.75");
  colonBottom.setAttribute("fill", "currentColor");
  colonBottom.setAttribute("stroke", "none");
  icon.append(screen, colonTop, colonBottom);
  return icon;
}

function modeIconSvg(): SVGSVGElement {
  const icon = svgElement("svg");
  icon.classList.add("ssp-time-picker__mode-icon");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  icon.setAttribute("viewBox", "0 0 24 24");
  return icon;
}

function buildAnalogView(
  options: TimePickerOptions,
  state: PickerState,
  callbacks: AnalogCallbacks
): HTMLElement {
  const view = element("div", "ssp-time-picker__analog");
  const selected = state.value === "" ? "00:00" : state.value;
  const [selectedHour, selectedMinute] = selected.split(":").map(Number);

  view.dataset.view = "analog";
  view.hidden = state.mode !== "analog";
  view.append(
    buildPeriodControls(options, selectedHour, selectedMinute, callbacks.adjust),
    buildAnalogValue(selected),
    buildHourGrid({ callbacks, options, selectedHour, selectedMinute })
  );
  return view;
}

function buildAnalogValue(value: string): HTMLElement {
  const output = element("div", "ssp-time-picker__analog-value");
  output.setAttribute("aria-live", "polite");
  output.textContent = value;
  return output;
}

function buildHourGrid({ callbacks, options, selectedHour, selectedMinute }: AnalogGridOptions): SVGSVGElement {
  const grid = buildClockFace("ssp-time-picker__clock-face ssp-time-picker__clock-face--hours");
  const hours = options.timeFormat === "12h" ? TWELVE_HOUR_LABELS : HOURS;
  let dragging = false;
  let pendingTime: string | null = null;
  const resolveTime = (event: PointerEvent): string => resolveAnalogTimeFromPointer(event, grid, options, selectedHour);
  grid.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    const time = resolveTime(event);
    if (!isTimeInRange(time, options.minTime, options.maxTime)) return;
    dragging = true;
    pendingTime = time;
    // Guarded: not every environment implements pointer capture (e.g. jsdom in tests), but
    // real browsers do, and it's what lets the drag keep tracking once the pointer leaves
    // the dial's circular bounds within its square viewBox.
    if (typeof grid.setPointerCapture === "function") grid.setPointerCapture(event.pointerId);
    callbacks.dragUpdate(time);
  });
  grid.addEventListener("pointermove", (event) => {
    event.stopPropagation();
    if (!dragging) return;
    const time = resolveTime(event);
    if (!isTimeInRange(time, options.minTime, options.maxTime)) return;
    pendingTime = time;
    callbacks.dragUpdate(time);
  });
  grid.addEventListener("pointerup", (event) => {
    event.stopPropagation();
    if (!dragging) return;
    const time = resolveTime(event);
    dragging = false;
    if (typeof grid.releasePointerCapture === "function") grid.releasePointerCapture(event.pointerId);
    pendingTime = isTimeInRange(time, options.minTime, options.maxTime) ? time : pendingTime;
    if (pendingTime !== null) callbacks.commit(pendingTime);
    pendingTime = null;
  });
  // Not "pointerleave": with pointer capture set on pointerdown, the drag is meant to keep
  // tracking even once the pointer visually leaves the dial's circular bounds (the SVG's
  // square viewBox has corners outside the ring) — only a real cancellation (e.g. the
  // browser reclaiming the gesture) should abandon an in-progress drag.
  grid.addEventListener("pointercancel", () => {
    dragging = false;
    pendingTime = null;
  });
  grid.append(buildClockHand(selectedHour, selectedMinute));
  hours.forEach((hour, index) => {
    const clockIndex = options.timeFormat === "12h" ? index : hour % 12;
    const normalizedHour = options.timeFormat === "12h" ? toTwentyFourHour(hour, selectedHour) : hour;
    const disabled = !doesHourIntersectRange(hour, options);
    const selected = options.timeFormat === "12h" ? toTwelveHour(selectedHour) === hour : selectedHour === hour;
    const label = options.timeFormat === "12h" ? String(hour) : String(hour).padStart(2, "0");
    const text = clockLabel({
      disabled,
      index: clockIndex,
      label,
      radius: options.timeFormat === "12h" ? undefined : hour < 12 ? 28 : 43,
      onSelect: (nextHour) => {
        callbacks.commit(`${String(nextHour).padStart(2, "0")}:${String(selectedMinute).padStart(2, "0")}`);
      },
      selected,
      total: 12,
      value: normalizedHour,
      valueType: "hour"
    });
    grid.append(text);
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
  adjust: (value: string) => void
): HTMLElement {
  const controls = element("div", "ssp-time-picker__periods");
  if (options.timeFormat !== "12h") return controls;

  controls.append(
    periodButton(buildPeriodButtonOptions("AM", options, { hour: selectedHour, minute: selectedMinute }, adjust)),
    periodButton(buildPeriodButtonOptions("PM", options, { hour: selectedHour, minute: selectedMinute }, adjust))
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

function clockLabel({
  disabled,
  index,
  label,
  onSelect,
  radius,
  selected,
  total,
  value,
  valueType
}: ClockLabelOptions): SVGTextElement {
  const text = svgElement("text");
  const position = clockPosition(index, total, radius);
  text.classList.add("ssp-time-picker__clock-label");
  text.dataset.selected = String(selected);
  text.dataset[valueType] = String(value);
  text.setAttribute("aria-disabled", String(disabled));
  text.setAttribute("aria-label", label);
  text.setAttribute("role", "button");
  text.setAttribute("tabindex", disabled ? "-1" : "0");
  text.setAttribute("x", position.x.toFixed(2));
  text.setAttribute("y", position.y.toFixed(2));
  text.textContent = label;
  text.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    if (!disabled) onSelect(value);
  });
  text.addEventListener("keydown", (event) => {
    if (disabled || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onSelect(value);
  });
  return text;
}

function buildClockFace(className: string): SVGSVGElement {
  const face = svgElement("svg");
  face.classList.add(...className.split(" "));
  face.setAttribute("aria-label", className.includes("--hours") ? "Analog hour selector" : "Analog minute selector");
  face.setAttribute("role", "group");
  face.setAttribute("viewBox", "0 0 100 100");
  face.append(buildClockRing(OUTER_CLOCK_RADIUS));
  if (className.includes("--hours")) face.append(buildClockRing(INNER_CLOCK_RADIUS));
  face.append(buildClockTicks(), buildClockCenter());
  return face;
}

function buildClockRing(radius: number): SVGCircleElement {
  const ring = svgElement("circle");
  ring.classList.add("ssp-time-picker__clock-ring");
  ring.setAttribute("cx", String(CLOCK_CENTER));
  ring.setAttribute("cy", String(CLOCK_CENTER));
  ring.setAttribute("r", String(radius));
  return ring;
}

function buildClockTicks(): SVGGElement {
  const ticks = svgElement("g");
  ticks.classList.add("ssp-time-picker__clock-ticks");
  for (let index = 0; index < 12; index += 1) {
    const outer = clockPosition(index, 12, OUTER_CLOCK_RADIUS);
    const inner = clockPosition(index, 12, OUTER_CLOCK_RADIUS - 3);
    const tick = svgElement("line");
    tick.setAttribute("x1", inner.x.toFixed(2));
    tick.setAttribute("y1", inner.y.toFixed(2));
    tick.setAttribute("x2", outer.x.toFixed(2));
    tick.setAttribute("y2", outer.y.toFixed(2));
    ticks.append(tick);
  }
  return ticks;
}

function buildClockCenter(): SVGCircleElement {
  const center = svgElement("circle");
  center.classList.add("ssp-time-picker__clock-center");
  center.setAttribute("cx", String(CLOCK_CENTER));
  center.setAttribute("cy", String(CLOCK_CENTER));
  center.setAttribute("r", "1.7");
  return center;
}

function buildClockHand(selectedHour: number, selectedMinute: number): SVGLineElement {
  const position = clockPosition((selectedHour % 12) + (selectedMinute / 60), 12, OUTER_CLOCK_RADIUS - 8);
  const hand = svgElement("line");
  hand.classList.add("ssp-time-picker__clock-hand");
  hand.setAttribute("x1", String(CLOCK_CENTER));
  hand.setAttribute("y1", String(CLOCK_CENTER));
  hand.setAttribute("x2", position.x.toFixed(2));
  hand.setAttribute("y2", position.y.toFixed(2));
  return hand;
}

function clockPosition(index: number, total: number, radius = OUTER_CLOCK_RADIUS): { x: number; y: number } {
  const angle = ((index / total) * 360) - 90;
  const radians = (angle * Math.PI) / 180;
  return {
    x: CLOCK_CENTER + (radius * Math.cos(radians)),
    y: CLOCK_CENTER + (radius * Math.sin(radians))
  };
}

function resolveAnalogTimeFromPointer(event: PointerEvent, face: SVGSVGElement, options: TimePickerOptions, selectedHour: number): string {
  const pointer = pointerPositionInSvg(event, face);
  const position = clockPositionFromPoint(pointer.x, pointer.y, 12);
  const hourIndex = Math.floor(position) % 12;
  const minuteStep = normalizeMinuteStep(options.minuteStep);
  let minute = Math.round(((position - hourIndex) * 60) / minuteStep) * minuteStep;
  const hourCarry = minute >= 60 ? 1 : 0;
  if (minute >= 60) minute = 0;

  const distance = Math.hypot(pointer.x - CLOCK_CENTER, pointer.y - CLOCK_CENTER);
  const hour = resolveHourFromClockPosition({ distance, hourCarry, hourIndex, options, selectedHour });

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function resolveHourFromClockPosition({
  distance,
  hourCarry,
  hourIndex,
  options,
  selectedHour
}: ResolveHourFromClockPositionOptions): number {
  if (options.timeFormat === "12h") {
    const baseHour = toTwentyFourHour(TWELVE_HOUR_LABELS[hourIndex], selectedHour);
    return (baseHour + hourCarry) % 24;
  }

  const baseHour = distance < (INNER_CLOCK_RADIUS + OUTER_CLOCK_RADIUS) / 2 ? hourIndex : hourIndex + 12;
  return (baseHour + hourCarry) % 24;
}

function pointerPositionInSvg(event: PointerEvent, face: SVGSVGElement): { x: number; y: number } {
  const rect = face.getBoundingClientRect();
  const width = rect.width || 100;
  const height = rect.height || 100;
  return {
    x: ((event.clientX - rect.left) / width) * 100,
    y: ((event.clientY - rect.top) / height) * 100
  };
}

function clockPositionFromPoint(x: number, y: number, total: number): number {
  const degrees = ((Math.atan2(y - CLOCK_CENTER, x - CLOCK_CENTER) * 180) / Math.PI + 450) % 360;
  return degrees / (360 / total);
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

function svgElement<K extends keyof SVGElementTagNameMap>(tagName: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tagName);
}
