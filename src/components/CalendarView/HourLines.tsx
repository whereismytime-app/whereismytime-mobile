import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { memo } from 'react';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

interface HourLinesProps {
  hourHeight: SharedValue<number>;
  calendarWidth: number;
}

export const HourLines = memo(function HourLines({ hourHeight, calendarWidth }: HourLinesProps) {
  // Build a single path for all 24 lines
  const gridPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    for (let i = 0; i < 24; i++) {
      const y = i * hourHeight.value;
      path.moveTo(0, y);
      path.lineTo(calendarWidth, y);
    }
    return path;
  }, [calendarWidth]); // Redraws lines only if width changes

  return (
    <Canvas style={{ position: 'absolute', inset: 0, left: 50, top: 60 }} pointerEvents="none">
      <Path path={gridPath} color="#F3F4F6" style="stroke" strokeWidth={1} />
    </Canvas>
  );
});
