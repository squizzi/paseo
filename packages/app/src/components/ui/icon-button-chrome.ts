import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { HEADER_CONTROL_HEIGHT } from "@/components/ui/control-geometry";
import {
  MOTION_ARRIVE_CSS,
  MOTION_HOVER_DURATION_MS,
  MOTION_HOVER_SCALE,
  MOTION_PRESS_SCALE,
} from "@/styles/motion-tokens";
import { ICON_SIZE } from "@/styles/theme";

export { extraMutedIconColorMapping, mutedIconColorMapping } from "@/components/ui/icon-color";

export type IconButtonChromeSize = "large" | "small";

const SMALL_ICON_BUTTON_SIZE = 20;
const COMPACT_SMALL_ICON_BUTTON_SIZE = 32;

export interface IconButtonChromeState {
  hovered?: boolean;
  pressed?: boolean;
  open?: boolean;
  active?: boolean;
}

function resolveIconButtonFrame(size: IconButtonChromeSize, compact: boolean) {
  if (size === "large") return styles.large;
  return compact ? styles.smallCompact : styles.small;
}

interface IconButtonChromeOptions {
  size: IconButtonChromeSize;
  state?: IconButtonChromeState;
  compact?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

function resolveIconButtonInteraction(state?: IconButtonChromeState) {
  const hovered = Boolean(state?.hovered);
  const pressed = Boolean(state?.pressed);
  const locked = Boolean(state?.active || state?.open);
  return {
    highlighted: Boolean(state?.active || hovered || pressed || state?.open),
    hoverScaled: hovered && !pressed && !locked,
    pressScaled: pressed,
  };
}

/** Shared hitbox and interaction chrome for icon-only header and toolbar controls. */
export function iconButtonChromeStyle({
  size,
  state,
  compact = false,
  disabled = false,
  style,
}: IconButtonChromeOptions): StyleProp<ViewStyle> {
  const interaction = resolveIconButtonInteraction(state);
  return [
    resolveIconButtonFrame(size, compact),
    styles.interactiveMotion,
    style,
    interaction.highlighted ? styles.highlighted : null,
    interaction.hoverScaled ? styles.hoverScale : null,
    interaction.pressScaled ? styles.pressScale : null,
    disabled ? styles.disabled : null,
  ];
}

/** Frame-only form for non-interactive placeholders that must preserve header alignment. */
export function iconButtonChromeFrameStyle(
  size: IconButtonChromeSize,
  compact = false,
): StyleProp<ViewStyle> {
  return resolveIconButtonFrame(size, compact);
}

export function iconButtonChromeGlyphSize(size: IconButtonChromeSize, compact = false): number {
  if (size === "large") return ICON_SIZE.md;
  return compact ? 18 : 14;
}

export function smallIconButtonChromeFrameSize(compact = false): number {
  return compact ? COMPACT_SMALL_ICON_BUTTON_SIZE : SMALL_ICON_BUTTON_SIZE;
}

const styles = StyleSheet.create((theme) => ({
  large: {
    width: {
      xs: 32,
      md: HEADER_CONTROL_HEIGHT,
    },
    height: {
      xs: 32,
      md: HEADER_CONTROL_HEIGHT,
    },
    padding: 0,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    outlineWidth: 0,
    outlineColor: "transparent",
  },
  small: {
    width: SMALL_ICON_BUTTON_SIZE,
    height: SMALL_ICON_BUTTON_SIZE,
    padding: 0,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    outlineWidth: 0,
    outlineColor: "transparent",
  },
  smallCompact: {
    width: COMPACT_SMALL_ICON_BUTTON_SIZE,
    height: COMPACT_SMALL_ICON_BUTTON_SIZE,
    padding: 0,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    outlineWidth: 0,
    outlineColor: "transparent",
  },
  highlighted: {
    backgroundColor: theme.colors.interactionHighlight,
  },
  interactiveMotion: {
    transitionProperty: "background-color, transform",
    transitionDuration: `${MOTION_HOVER_DURATION_MS}ms`,
    transitionTimingFunction: MOTION_ARRIVE_CSS,
  },
  hoverScale: {
    transform: [{ scale: MOTION_HOVER_SCALE }],
  },
  pressScale: {
    transform: [{ scale: MOTION_PRESS_SCALE }],
  },
  disabled: {
    opacity: theme.opacity[50],
  },
}));
