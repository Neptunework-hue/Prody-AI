import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { Habit } from '../../types/habit';
import { FONT_SERIF } from '../../constants/lifeTrackerDesign';
import { useAppTheme } from '../../contexts/AppThemeContext';
import { localDateKey } from '../../services/questStreak';
import {
  HABIT_DOT_DAY_COUNT,
  habitFrequencySubtitle,
  habitScheduleRateInWindow,
  localDateKeysEndingToday,
} from '../../utils/habitCardHelpers';

function habitXp(h: Habit): number {
  return h.xp_reward ?? 15;
}

type Props = {
  habit: Habit;
  rowsForHabit: { date: string; value?: number }[];
  onLogToday?: () => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
};

export default function HabitQuestCard({ habit, rowsForHabit, onLogToday, onDelete }: Props) {
  const { colors: c } = useAppTheme();
  const today = localDateKey(new Date());
  const doneToday = rowsForHabit.some((r) => r.date === today && (r.value ?? 0) > 0);
  const keys = localDateKeysEndingToday(HABIT_DOT_DAY_COUNT);
  const byDate = new Map(rowsForHabit.map((r) => [r.date, r.value ?? 0] as const));

  const dots = keys.map((dateKey) => ({
    dateKey,
    filled: (byDate.get(dateKey) ?? 0) > 0,
  }));

  const rate = habitScheduleRateInWindow(habit, rowsForHabit, HABIT_DOT_DAY_COUNT);
  const subLeft = habitFrequencySubtitle(habit);
  const xp = habitXp(habit);

  const cardBg = c.surfaceElevated;
  const titleC = c.tx;
  const subC = c.tx2;
  const dotEmptyBorder = c.borderStrong;

  const logDisabled = !onLogToday || doneToday;

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: c.amberBorder }]}>
      <View style={styles.mainRow}>
        <Pressable
          style={styles.pressMain}
          onPress={onLogToday}
          disabled={logDisabled}
          accessibilityRole={onLogToday ? 'button' : undefined}
          accessibilityLabel={doneToday ? 'Habit completed today' : 'Log habit for today'}
        >
          <Text style={[styles.title, { color: titleC }]} numberOfLines={2}>
            {habit.title}
          </Text>
          <Text style={[styles.sub, { color: subC }]}>
            {subLeft} · {rate}% rate
          </Text>
          <View style={styles.dotsRow}>
            {dots.map((d, i) => (
              <View
                key={d.dateKey + i}
                style={[
                  styles.dot,
                  d.filled ? [styles.dotFilled, { backgroundColor: c.teal }] : [styles.dotEmpty, { borderColor: dotEmptyBorder }],
                ]}
              />
            ))}
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.hint, { color: c.tx2 }]}>
              +{xp} XP · {doneToday ? 'Done today' : 'Tap to log'}
            </Text>
            {doneToday ? (
              <Text style={[styles.hint, { color: c.teal }]}>Logged today</Text>
            ) : null}
          </View>
        </Pressable>
        {onDelete ? (
          <IconButton
            icon="delete-outline"
            size={22}
            onPress={onDelete}
            accessibilityLabel="Delete habit"
            iconColor={c.tx2}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pressMain: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: FONT_SERIF,
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  sub: {
    fontSize: 13,
    marginBottom: 8,
    fontFamily: FONT_SERIF,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotFilled: {},
  dotEmpty: {
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  hint: {
    fontSize: 12,
    fontFamily: FONT_SERIF,
  },
});
