/**
 * Picker view mode.
 */
export type TimePickerMode = "analog" | "digital";

/**
 * Display format for labels and typed values.
 */
export type TimeFormat = "12h" | "24h";

/**
 * Configuration for a vanilla time picker instance.
 */
export interface TimePickerOptions {
  disabled?: boolean;
  id?: string;
  label?: string;
  maxTime?: string;
  minTime?: string;
  minuteStep?: number;
  mode?: TimePickerMode;
  name?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  timeFormat?: TimeFormat;
  value?: string;
}

/**
 * Imperative controls returned by createTimePicker.
 */
export interface TimePickerInstance {
  destroy: () => void;
  mount: (host: HTMLElement) => void;
  setDisabled: (disabled: boolean) => void;
  setValue: (value: string) => void;
}
