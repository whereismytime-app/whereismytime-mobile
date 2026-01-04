import { Group, Paint, Paragraph, Rect, SkFont, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { DAY_HEADER_HEIGHT, EventBlockData } from './constants';

export interface SkiaEventBlockProps {
  event: EventBlockData;
  hourHeight: SharedValue<number>;
  columnWidth: SharedValue<number>;
  font: SkFont;
}

export const EventBlock = ({ event, hourHeight, columnWidth, font }: SkiaEventBlockProps) => {
  const startMin = event.start!.getHours() * 60 + event.start!.getMinutes();
  const duration = (event.end!.getTime() - event.start!.getTime()) / 60000;
  const width = useDerivedValue(() => columnWidth.value * event.width);

  const y = useDerivedValue(() => (startMin / 60) * hourHeight.value + DAY_HEADER_HEIGHT);
  const height = useDerivedValue(() => (duration / 60) * hourHeight.value);
  const rectWidth = useDerivedValue(() => Math.min(width.value, columnWidth.value - 2));
  const x = useDerivedValue(() => columnWidth.value - rectWidth.value - 2);

  const clipPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    path.addRect(Skia.XYWHRect(0, 0, Math.max(0, rectWidth.value), height.value + 1000));
    return path;
  });

  const paragraph = useMemo(() => {
    if (!font) return null;
    const paragraphStyle = {
      maxLines: 2,
      ellipsis: '...',
    };
    const textStyle = {
      fontSize: 10,
      color: Skia.Color('white'),
    };
    return Skia.ParagraphBuilder.Make(paragraphStyle)
      .pushStyle(textStyle)
      .addText(event.title)
      .build();
  }, [event.title, font]);

  return (
    <>
      <Rect
        x={x}
        y={y}
        width={rectWidth}
        height={height}
        color={event.category?.color || '#3B82F6'}>
        <Paint style="stroke" strokeWidth={1.5} strokeJoin={'round'} color="black" />
      </Rect>
      {/* Skia Text with simple clipping */}
      <Paragraph
        paragraph={paragraph}
        x={useDerivedValue(() => x.value + 4)}
        y={useDerivedValue(() => y.value + 4)}
        width={useDerivedValue(() => rectWidth.value - 8)}
      />
      <Group clip={clipPath}></Group>
    </>
  );
};
