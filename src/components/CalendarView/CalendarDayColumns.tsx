import { SkFont } from '@shopify/react-native-skia';
import React, { memo, useState } from 'react';
import { SharedValue, useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { DayColumn } from './DayColumn';
import { SCROLL_TODAY_INDEX, SCROLL_TOTAL_DAYS, SelectedEvent } from './common';

interface CalendarDayColumnsProps {
  scrollX: SharedValue<number>;
  scrollY: SharedValue<number>;
  columnWidth: SharedValue<number>;
  hourHeight: SharedValue<number>;
  selectedEvent: SharedValue<SelectedEvent | null>;
  numDays: number;
  font: SkFont;
  headerFont: SkFont;
}

export const CalendarDayColumns = memo(function CalendarDayColumns({
  scrollX,
  scrollY,
  columnWidth,
  hourHeight,
  selectedEvent,
  numDays,
  font,
  headerFont,
}: CalendarDayColumnsProps) {
  const [visibleStartIndex, setVisibleStartIndex] = useState(SCROLL_TODAY_INDEX);

  // Update visible index to trigger React re-renders only for this component
  // decoupling the parent from scroll updates
  useAnimatedReaction(
    () => {
      if (columnWidth.value === 0) return SCROLL_TODAY_INDEX;
      return Math.floor(scrollX.value / columnWidth.value);
    },
    (index, prevIndex) => {
      // Only update if the index has changed significantly to avoid frequent updates during momentum
      // Current buffer is 5, so we can wait until we are closer to the edge
      const diff = Math.abs(index - visibleStartIndex);
      if (index !== prevIndex && diff > 2) {
        scheduleOnRN(setVisibleStartIndex, index);
      }
    },
    [columnWidth, scrollX, visibleStartIndex] // Dependencies
  );

  // Determine which indices to render (e.g., current view + 5 buffer on each side for smoother momentum)
  const renderIndices = React.useMemo(() => {
    const start = Math.max(0, visibleStartIndex - 5);
    const end = Math.min(SCROLL_TOTAL_DAYS, visibleStartIndex + numDays + 5);
    const indices = [];
    for (let i = start; i <= end; i++) indices.push(i);
    return indices;
  }, [visibleStartIndex, numDays]);

  return (
    <>
      {renderIndices.map((index) => {
        const date = new Date();
        date.setDate(date.getDate() + (index - SCROLL_TODAY_INDEX));
        const dateKey = date.toISOString().split('T')[0];

        return (
          <DayColumn
            key={dateKey} // React unmounts/mounts as dates leave the window
            index={index}
            dateKey={dateKey}
            columnWidth={columnWidth}
            hourHeight={hourHeight}
            scrollY={scrollY}
            font={font}
            selectedEvent={selectedEvent}
            headerFont={headerFont}
          />
        );
      })}
    </>
  );
});
