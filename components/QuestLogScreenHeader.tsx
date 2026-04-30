import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import HamburgerMenu from './HamburgerMenu';
import { FONT_SERIF } from '../constants/lifeTrackerDesign';

type Props = {
  title: string;
  sidebarVisible: boolean;
  onOpenSidebar: () => void;
  /** Override title color (e.g. dashboard shell uses `shell.tx`). */
  titleColor?: string;
  /** Right slot (refresh, calendar actions, etc.). Omit for a balanced spacer. */
  right?: React.ReactNode;
};

export default function QuestLogScreenHeader({
  title,
  sidebarVisible,
  onOpenSidebar,
  titleColor,
  right,
}: Props) {
  const theme = useTheme();
  const resolvedTitleColor = titleColor ?? theme.colors.onSurface;

  return (
    <View style={styles.topBar}>
      <View style={styles.topBarSide}>
        <HamburgerMenu onPress={onOpenSidebar} isOpen={sidebarVisible} />
      </View>
      <Text style={[styles.topBarTitle, { color: resolvedTitleColor }]}>{title}</Text>
      <View style={[styles.topBarSide, styles.topBarSideRight]}>
        {right != null ? right : <View style={styles.rightSpacer} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 12,
  },
  topBarSide: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  topBarSideRight: {
    alignItems: 'flex-end',
    minWidth: 44,
  },
  rightSpacer: {
    width: 44,
    height: 1,
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONT_SERIF,
    fontSize: 20,
    fontWeight: '600',
  },
});
