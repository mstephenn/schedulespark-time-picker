import { afterEach, describe, expect, it, vi } from "vitest";

import { createTimePicker } from "../src";

describe("createTimePicker", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("mounts a vanilla analog and digital picker", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const picker = createTimePicker({ label: "Start time", value: "09:00" });

    picker.mount(host);

    expect(host.querySelector("input")?.value).toBe("09:00");
    expect(host.querySelector("label")?.getAttribute("for")).toBe(host.querySelector("input")?.id);
    expect(host.querySelector(".ssp-time-picker__popover")?.getAttribute("hidden")).toBe("");
    expect(host.querySelector("[data-view='analog']")).not.toBeNull();
    expect(host.querySelector(".ssp-time-picker__clock-face")).not.toBeNull();
    expect(host.querySelector("[data-view='digital']")).not.toBeNull();
    expect(host.textContent).toContain("Start time");
  });

  it("opens the picker popover from the input and closes it with Escape", () => {
    const host = document.createElement("div");
    document.body.append(host);

    createTimePicker({ value: "09:00" }).mount(host);
    const input = host.querySelector("input");

    input?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));

    expect(host.querySelector(".ssp-time-picker__popover")?.hasAttribute("hidden")).toBe(false);

    input?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));

    expect(host.querySelector(".ssp-time-picker__popover")?.getAttribute("hidden")).toBe("");
  });

  it("closes the picker popover when clicking outside", () => {
    const host = document.createElement("div");
    const outside = document.createElement("button");
    document.body.append(host, outside);

    createTimePicker({ value: "09:00" }).mount(host);
    host.querySelector("input")?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));

    outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

    expect(host.querySelector(".ssp-time-picker__popover")?.getAttribute("hidden")).toBe("");
  });

  it("emits HH:mm when a digital option is selected", () => {
    const host = document.createElement("div");
    const onChange = vi.fn();
    document.body.append(host);

    createTimePicker({ value: "09:00", minuteStep: 30, onChange }).mount(host);
    host.querySelector("input")?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    host.querySelector<HTMLButtonElement>("[data-time-value='09:30']")?.click();

    expect(onChange).toHaveBeenCalledWith("09:30");
    expect(host.querySelector("input")?.value).toBe("09:30");
    expect(host.querySelector(".ssp-time-picker__popover")?.getAttribute("hidden")).toBe("");
  });

  it("selects time from the analog clock face", () => {
    const host = document.createElement("div");
    const onChange = vi.fn();
    document.body.append(host);

    createTimePicker({ value: "09:00", minuteStep: 15, onChange }).mount(host);
    host.querySelector("input")?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    host.querySelector<HTMLButtonElement>("[data-hour='10']")?.click();
    host.querySelector("input")?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    host.querySelector<HTMLButtonElement>("[data-minute='30']")?.click();

    expect(onChange).toHaveBeenLastCalledWith("10:30");
    expect(host.querySelector("input")?.value).toBe("10:30");
    expect(host.querySelector(".ssp-time-picker__popover")?.getAttribute("hidden")).toBe("");
  });

  it("does not open the picker popover when disabled", () => {
    const host = document.createElement("div");
    document.body.append(host);

    createTimePicker({ disabled: true, value: "09:00" }).mount(host);

    host.querySelector("input")?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));

    expect(host.querySelector(".ssp-time-picker__popover")?.getAttribute("hidden")).toBe("");
  });

  it("normalizes typed values on blur", () => {
    const host = document.createElement("div");
    const onChange = vi.fn();
    document.body.append(host);

    createTimePicker({ value: "09:00", onChange }).mount(host);
    const input = host.querySelector("input");
    input?.focus();
    input!.value = "745";
    input?.dispatchEvent(new Event("input", { bubbles: true }));
    input?.dispatchEvent(new FocusEvent("blur", { bubbles: true }));

    expect(onChange).toHaveBeenLastCalledWith("07:45");
    expect(input?.value).toBe("07:45");
  });

  it("disables digital values outside min and max time", () => {
    const host = document.createElement("div");
    document.body.append(host);

    createTimePicker({ maxTime: "10:00", minTime: "09:00", mode: "digital", value: "09:00" }).mount(host);

    expect(host.querySelector<HTMLButtonElement>("[data-time-value='08:45']")?.disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>("[data-time-value='09:15']")?.disabled).toBe(false);
    expect(host.querySelector<HTMLButtonElement>("[data-time-value='10:15']")?.disabled).toBe(true);
  });

  it("disables analog selections outside min and max time", () => {
    const host = document.createElement("div");
    document.body.append(host);

    createTimePicker({ maxTime: "10:00", minTime: "09:00", value: "09:00" }).mount(host);

    expect(host.querySelector<HTMLButtonElement>("[data-hour='8']")?.disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>("[data-hour='9']")?.disabled).toBe(false);
    expect(host.querySelector<HTMLButtonElement>("[data-hour='11']")?.disabled).toBe(true);
  });

  it("shows AM/PM controls in 12-hour display mode while emitting HH:mm", () => {
    const host = document.createElement("div");
    const onChange = vi.fn();
    document.body.append(host);

    createTimePicker({ timeFormat: "12h", value: "13:30", onChange }).mount(host);

    expect(host.querySelector("input")?.value).toBe("1:30 PM");
    expect(host.querySelector("[data-period='AM']")).not.toBeNull();
    expect(host.querySelector("[data-period='PM']")?.getAttribute("data-active")).toBe("true");

    host.querySelector<HTMLButtonElement>("[data-period='AM']")?.click();

    expect(onChange).toHaveBeenLastCalledWith("01:30");
    expect(host.querySelector("input")?.value).toBe("1:30 AM");
  });

  it("keeps 12-hour period controls disabled when the period is outside range", () => {
    const host = document.createElement("div");
    document.body.append(host);

    createTimePicker({ maxTime: "11:59", minTime: "08:00", timeFormat: "12h", value: "09:00" }).mount(host);

    expect(host.querySelector<HTMLButtonElement>("[data-period='AM']")?.disabled).toBe(false);
    expect(host.querySelector<HTMLButtonElement>("[data-period='PM']")?.disabled).toBe(true);
  });

  it("keeps the popover open when a real pointer sequence switches Analog/Digital mode, and still commits a subsequent selection", () => {
    const host = document.createElement("div");
    const onChange = vi.fn();
    document.body.append(host);

    createTimePicker({ minuteStep: 30, onChange, value: "09:00" }).mount(host);
    host.querySelector("input")?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    expect(host.querySelector(".ssp-time-picker__popover")?.hasAttribute("hidden")).toBe(false);

    // A real click is preceded by mousedown, which is exactly the event whose default this
    // component must prevent (see the comment on buildPicker's mousedown listener) — using
    // .click() alone would not exercise that path, since it fires no mousedown of its own.
    const digitalModeButton = host.querySelector<HTMLButtonElement>("[data-active='false'].ssp-time-picker__mode");
    digitalModeButton?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    digitalModeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(host.querySelector(".ssp-time-picker__popover")?.hasAttribute("hidden")).toBe(false);
    // Re-query: switching mode rebuilds the popover's contents, so the button reference
    // captured before the click is now a detached node.
    expect(host.querySelector<HTMLButtonElement>("[data-active='true'].ssp-time-picker__mode")?.textContent).toBe(
      "Digital"
    );

    const digitalOption = host.querySelector<HTMLButtonElement>("[data-time-value='09:30']");
    digitalOption?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    digitalOption?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith("09:30");
    expect(host.querySelector(".ssp-time-picker__popover")?.getAttribute("hidden")).toBe("");
  });

  it("prevents the default mousedown action on popover controls so they never steal focus from the input", () => {
    const host = document.createElement("div");
    document.body.append(host);

    createTimePicker({ value: "09:00" }).mount(host);
    host.querySelector("input")?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));

    const modeButton = host.querySelector<HTMLButtonElement>(".ssp-time-picker__mode");
    const mousedown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    modeButton?.dispatchEvent(mousedown);

    expect(mousedown.defaultPrevented).toBe(true);
  });

  it("reopens the popover when clicking the still-focused input again after a selection closed it", () => {
    const host = document.createElement("div");
    document.body.append(host);

    createTimePicker({ minuteStep: 30, value: "09:00" }).mount(host);
    const input = host.querySelector("input");
    input?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    host.querySelector<HTMLButtonElement>("[data-time-value='09:30']")?.click();

    expect(host.querySelector(".ssp-time-picker__popover")?.getAttribute("hidden")).toBe("");

    // The input never actually blurred (popover buttons prevent that), so no further
    // `focus` event fires here — this is exactly why the input also needs a `click` handler.
    input?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(host.querySelector(".ssp-time-picker__popover")?.hasAttribute("hidden")).toBe(false);
  });

  it("closes an open popover when disabled via the imperative setDisabled API", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const picker = createTimePicker({ value: "09:00" });
    picker.mount(host);
    host.querySelector("input")?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    expect(host.querySelector(".ssp-time-picker__popover")?.hasAttribute("hidden")).toBe(false);

    picker.setDisabled(true);

    expect(host.querySelector(".ssp-time-picker__popover")?.getAttribute("hidden")).toBe("");
    expect(host.querySelector("input")?.disabled).toBe(true);
  });

  it("updates the displayed value via setValue without closing an open popover", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const picker = createTimePicker({ value: "09:00" });
    picker.mount(host);
    host.querySelector("input")?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));

    picker.setValue("11:00");

    expect(host.querySelector("input")?.value).toBe("11:00");
    expect(host.querySelector(".ssp-time-picker__popover")?.hasAttribute("hidden")).toBe(false);
  });

  it("ignores an unparseable setValue call rather than blanking the field", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const picker = createTimePicker({ value: "09:00" });
    picker.mount(host);

    picker.setValue("not-a-time");

    expect(host.querySelector("input")?.value).toBe("09:00");
  });

  it("reverts to the last valid value on blur when the typed text does not parse, without emitting onChange", () => {
    const host = document.createElement("div");
    const onChange = vi.fn();
    document.body.append(host);

    createTimePicker({ onChange, value: "09:00" }).mount(host);
    const input = host.querySelector("input");
    input?.focus();
    input!.value = "not a time";
    input?.dispatchEvent(new Event("input", { bubbles: true }));
    input?.dispatchEvent(new FocusEvent("blur", { bubbles: true }));

    expect(onChange).not.toHaveBeenCalled();
    expect(input?.value).toBe("09:00");
  });

  it("keeps the popover open when adjusting the value with arrow keys", () => {
    const host = document.createElement("div");
    const onChange = vi.fn();
    document.body.append(host);

    createTimePicker({ minuteStep: 15, onChange, value: "09:00" }).mount(host);
    const input = host.querySelector("input");
    input?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));

    input?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowUp" }));

    expect(onChange).toHaveBeenCalledWith("09:15");
    expect(host.querySelector(".ssp-time-picker__popover")?.hasAttribute("hidden")).toBe(false);
  });
});
