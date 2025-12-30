const HOURS_IN_DAY = 24;
const MIN_HOUR_HEIGHT = 40;
const DEFAULT_HOUR_HEIGHT = 60;
const EVENT_HORIZONTAL_PADDING = 2;
const MIN_EVENT_HEIGHT = 20;
const DAY_HEADER_HEIGHT = 60;
const TIME_AXIS_WIDTH = 50;

/**
 * Previously set to 180.
 * But then got hit with Metal Validation Error:
 * Texture Descriptor Validation MTLTextureDescriptor has height (8445) greater than the maximum allowed size of 8192.
 */
const MAX_HOUR_HEIGHT = Math.floor(8192 / HOURS_IN_DAY);

const SCROLL_TOTAL_DAYS = 1000; // Total scrollable range
const SCROLL_INITIAL_INDEX = 500;

export {
  SCROLL_TOTAL_DAYS,
  SCROLL_INITIAL_INDEX,
  DEFAULT_HOUR_HEIGHT,
  EVENT_HORIZONTAL_PADDING,
  MIN_EVENT_HEIGHT,
  DAY_HEADER_HEIGHT,
  HOURS_IN_DAY,
  MIN_HOUR_HEIGHT,
  MAX_HOUR_HEIGHT,
  TIME_AXIS_WIDTH,
};
