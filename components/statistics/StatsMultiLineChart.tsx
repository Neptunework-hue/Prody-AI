import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, {
  Path,
  Line,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
  G,
} from 'react-native-svg';
import { FONT_SERIF } from '../../constants/lifeTrackerDesign';
import { useAppTheme } from '../../contexts/AppThemeContext';

export type StatsSeriesKey = 'xp' | 'quests' | 'focus' | 'habits';

export type StatsSeries = Record<StatsSeriesKey, number[]>;

export type StatsVisibility = Record<StatsSeriesKey, boolean>;

const SERVE_ORDER: StatsSeriesKey[] = ['xp', 'quests', 'focus', 'habits'];

type Props = {
  series: StatsSeries;
  visible: StatsVisibility;
  dayKeys: string[];
  gridColor: string;
  labelColor: string;
  /** Chart panel fill */
  surfaceColor: string;
};

const CHART_HEIGHT = 220;
const PAD_L = 40;
const PAD_R = 12;
const PAD_T = 8;
const PAD_B = 28;

function maxOrOne(v: number[]): number {
  const m = Math.max(...v, 0);
  return m > 0 ? m : 1;
}

function buildLinePath(
  values: number[],
  innerW: number,
  innerH: number,
  maxV: number,
): string {
  const n = values.length;
  if (n < 2) return '';
  let d = '';
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * innerW;
    const y = innerH - (values[i] / maxV) * innerH;
    if (i === 0) d += `M ${x} ${y}`;
    else d += ` L ${x} ${y}`;
  }
  return d;
}

function buildAreaPath(
  values: number[],
  innerW: number,
  innerH: number,
  maxV: number,
): string {
  const line = buildLinePath(values, innerW, innerH, maxV);
  if (!line) return '';
  const n = values.length;
  const xLast = innerW;
  const x0 = 0;
  const yB = innerH;
  return `${line} L ${xLast} ${yB} L ${x0} ${yB} Z`;
}

/** Pick Y-axis scale from first visible series in design order. */
function primaryKey(vis: StatsVisibility): StatsSeriesKey {
  for (const k of SERVE_ORDER) {
    if (vis[k]) return k;
  }
  return 'xp';
}

export default function StatsMultiLineChart({
  series,
  visible,
  dayKeys,
  gridColor,
  labelColor,
  surfaceColor,
}: Props) {
  const { colors: chartPalette } = useAppTheme();
  const seriesStrokeColors = useMemo(
    () =>
      ({
        xp: chartPalette.amber,
        quests: chartPalette.teal,
        focus: chartPalette.blue,
        habits: chartPalette.pink,
      }) satisfies Record<StatsSeriesKey, string>,
    [chartPalette],
  );
  const screenW = Dimensions.get('window').width;
  const chartW = screenW - 32;
  const innerW = chartW - PAD_L - PAD_R;
  const innerH = CHART_HEIGHT - PAD_T - PAD_B;

  const primary = primaryKey(visible);
  const maxPrimary = maxOrOne(series[primary]);

  const yTicks = useMemo(() => {
    const steps = 4;
    const arr: number[] = [];
    for (let i = 0; i <= steps; i++) {
      arr.push(Math.round((maxPrimary * i) / steps));
    }
    return arr;
  }, [maxPrimary]);

  const paths = useMemo(() => {
    const out: Partial<Record<StatsSeriesKey, { line: string; area?: string; max: number }>> = {};
    (Object.keys(series) as StatsSeriesKey[]).forEach((key) => {
      const vals = series[key];
      const maxV = maxOrOne(vals);
      out[key] = {
        line: buildLinePath(vals, innerW, innerH, maxV),
        area:
          key === 'xp'
            ? buildAreaPath(vals, innerW, innerH, maxV)
            : undefined,
        max: maxV,
      };
    });
    return out;
  }, [series, innerW, innerH]);

  const xLabelIndices = [0, 6, 12, 18, 24, 29].filter((i) => i < dayKeys.length);

  return (
    <View style={[styles.wrap, { borderColor: gridColor, backgroundColor: surfaceColor }]}>
      <Svg width={chartW} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="statsXpFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={chartPalette.amber} stopOpacity="0.38" />
            <Stop offset="1" stopColor={chartPalette.amber} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <G transform={`translate(${PAD_L},${PAD_T})`}>
          {yTicks.map((tick, i) => {
            const y = innerH - (tick / maxPrimary) * innerH;
            return (
              <G key={`g-${i}`}>
                <Line
                  x1={0}
                  y1={y}
                  x2={innerW}
                  y2={y}
                  stroke={gridColor}
                  strokeWidth={1}
                  strokeOpacity={0.65}
                />
                <SvgText
                  x={-6}
                  y={y + 4}
                  fontSize={10}
                  fill={labelColor}
                  textAnchor="end"
                  fontFamily={FONT_SERIF}
                >
                  {tick}
                </SvgText>
              </G>
            );
          })}

          {visible.xp && paths.xp?.area && (
            <Path d={paths.xp.area} fill="url(#statsXpFill)" />
          )}

          {(Object.keys(seriesStrokeColors) as StatsSeriesKey[]).map((key) => {
            if (!visible[key] || !paths[key]?.line) return null;
            return (
              <Path
                key={key}
                d={paths[key]!.line}
                stroke={seriesStrokeColors[key]}
                strokeWidth={key === 'xp' ? 2.5 : 2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}

          {xLabelIndices.map((idx) => {
            const x = (idx / Math.max(1, dayKeys.length - 1)) * innerW;
            const dk = dayKeys[idx];
            const dayNum = dk ? dk.split('-')[2]?.replace(/^0/, '') ?? '' : '';
            return (
              <SvgText
                key={`x-${idx}`}
                x={x}
                y={innerH + 18}
                fontSize={10}
                fill={labelColor}
                textAnchor="middle"
                fontFamily={FONT_SERIF}
              >
                {dayNum}
              </SvgText>
            );
          })}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
});
