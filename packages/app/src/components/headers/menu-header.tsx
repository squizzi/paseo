import { useCallback, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { PanelLeft } from "lucide-react-native";
import { ScreenHeader } from "./screen-header";
import { ScreenTitle } from "./screen-title";
import { HeaderToggleButton, headerIconSlotStyle } from "./header-toggle-button";
import { selectIsAgentListOpen, usePanelStore } from "@/stores/panel-store";
import { useIsCompactFormFactor } from "@/constants/layout";
import { getShortcutOs } from "@/utils/shortcut-platform";
import { useHasWindowChromeObstruction, useOwnsWindowChromeCorner } from "@/utils/desktop-window";
import { iconButtonChromeGlyphSize } from "@/components/ui/icon-button-chrome";
import { HEADER_CONTROL_HEIGHT } from "@/components/ui/control-geometry";
import { isWeb } from "@/constants/platform";
import {
  MOTION_ARRIVE_CSS,
  MOTION_ARRIVE_DURATION_MS,
  MOTION_EXIT_CSS,
  MOTION_EXIT_DURATION_MS,
} from "@/styles/motion-tokens";
import { inlineUnistylesStyle } from "@/styles/unistyles-inline-style";

interface MenuHeaderProps {
  title?: string;
  rightContent?: ReactNode;
  borderless?: boolean;
}

interface SidebarMenuToggleProps {
  style?: StyleProp<ViewStyle>;
  tooltipSide?: "left" | "right" | "top" | "bottom";
  testID?: string;
  nativeID?: string;
  disabled?: boolean;
  accessible?: boolean;
}

const MOBILE_MENU_LINE_WIDTH = 16;
const MOBILE_MENU_LINE_SHORT_WIDTH = 8;
const MOBILE_MENU_LINE_HEIGHT = 1.5;

function MobileMenuIcon({ color }: { color: string }) {
  const lineStyle = useMemo(() => [styles.mobileMenuLine, { backgroundColor: color }], [color]);
  const shortLineStyle = useMemo(
    () => [styles.mobileMenuLine, styles.mobileMenuLineShort, { backgroundColor: color }],
    [color],
  );
  return (
    <View style={styles.mobileMenuIcon} pointerEvents="none">
      <View style={lineStyle} />
      <View style={lineStyle} />
      <View style={shortLineStyle} />
    </View>
  );
}

function SidebarMenuToggleButton({
  isMobile,
  extraMutedIdleIcon = false,
  resolvedStyle,
  tooltipSide = "right",
  testID = "menu-button",
  nativeID = "menu-button",
  disabled,
  accessible,
}: Omit<SidebarMenuToggleProps, "style"> & {
  isMobile: boolean;
  extraMutedIdleIcon?: boolean;
  resolvedStyle: StyleProp<ViewStyle>;
}) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const isOpen = usePanelStore((state) => selectIsAgentListOpen(state, { isCompact: isMobile }));
  const toggleAgentListForLayout = usePanelStore((state) => state.toggleAgentListForLayout);
  const toggleShortcutKeys = useMemo(
    () => (getShortcutOs() === "mac" ? ["mod", "B"] : ["mod", "."]),
    [],
  );

  const handlePress = useCallback(() => {
    toggleAgentListForLayout({ isCompact: isMobile });
  }, [toggleAgentListForLayout, isMobile]);

  const accessibilityState = useMemo(() => ({ expanded: isOpen }), [isOpen]);

  return (
    <HeaderToggleButton
      onPress={handlePress}
      tooltipLabel={t("shell.menu.toggleSidebar")}
      tooltipKeys={toggleShortcutKeys}
      tooltipSide={tooltipSide}
      testID={testID}
      nativeID={nativeID}
      style={resolvedStyle}
      disabled={disabled}
      accessible={accessible ?? true}
      accessibilityRole="button"
      accessibilityLabel={isOpen ? t("shell.menu.close") : t("shell.menu.open")}
      accessibilityState={accessibilityState}
    >
      {isMobile ? (
        <MobileMenuIcon
          color={
            extraMutedIdleIcon ? theme.colors.foregroundExtraMuted : theme.colors.foregroundMuted
          }
        />
      ) : (
        <PanelLeft
          size={iconButtonChromeGlyphSize("large")}
          strokeWidth={1.5}
          color={
            extraMutedIdleIcon ? theme.colors.foregroundExtraMuted : theme.colors.foregroundMuted
          }
        />
      )}
    </HeaderToggleButton>
  );
}

export function SidebarMenuToggle({ style, ...props }: SidebarMenuToggleProps = {}) {
  const isMobile = useIsCompactFormFactor();
  const ownsTopLeft = useOwnsWindowChromeCorner("top-left");
  const hasTopLeftWindowControls = useHasWindowChromeObstruction("top-left");
  const previousOwnsTopLeftRef = useRef<boolean | null>(null);

  const transitionStyle = useMemo(() => {
    const prev = previousOwnsTopLeftRef.current;
    if (!isWeb || prev === null) {
      return null;
    }
    // Growing (sidebar closing) -> matches sidebar exit timing
    // Shrinking (sidebar opening) -> matches sidebar arrive timing
    const duration = ownsTopLeft ? MOTION_EXIT_DURATION_MS : MOTION_ARRIVE_DURATION_MS;
    const timing = ownsTopLeft ? MOTION_EXIT_CSS : MOTION_ARRIVE_CSS;
    return `width ${duration}ms ${timing}, opacity ${duration}ms ${timing}`;
  }, [ownsTopLeft]);

  useLayoutEffect(() => {
    previousOwnsTopLeftRef.current = ownsTopLeft;
  }, [ownsTopLeft]);

  const resolvedStyle = useMemo(() => [styles.leadingToggle, style], [style]);

  const wrapperStyle = useMemo(() => {
    const slotStyle = ownsTopLeft
      ? { width: HEADER_CONTROL_HEIGHT, opacity: 1, overflow: "hidden" as const }
      : { width: 0, opacity: 0, overflow: "hidden" as const };
    return [
      styles.leadingToggle,
      slotStyle,
      transitionStyle ? inlineUnistylesStyle({ transition: transitionStyle } as ViewStyle) : null,
    ];
  }, [ownsTopLeft, transitionStyle]);

  if (isMobile) {
    return <SidebarMenuToggleButton {...props} isMobile resolvedStyle={resolvedStyle} />;
  }

  const content = hasTopLeftWindowControls ? (
    <View pointerEvents="none" style={headerIconSlotStyle.slot}>
      <View style={styles.desktopMenuIconSpace} />
    </View>
  ) : (
    <SidebarMenuToggleButton
      {...props}
      disabled={!ownsTopLeft}
      accessible={ownsTopLeft}
      isMobile={false}
      resolvedStyle={style}
    />
  );

  return (
    <View
      pointerEvents={ownsTopLeft ? undefined : "none"}
      accessibilityElementsHidden={!ownsTopLeft}
      importantForAccessibility={ownsTopLeft ? "auto" : "no-hide-descendants"}
      style={wrapperStyle}
    >
      {content}
    </View>
  );
}

export function WindowSidebarMenuToggle({ style, ...props }: SidebarMenuToggleProps = {}) {
  const resolvedStyle = useMemo(() => [styles.leadingToggle, style], [style]);
  return (
    <SidebarMenuToggleButton
      {...props}
      isMobile={false}
      extraMutedIdleIcon
      resolvedStyle={resolvedStyle}
    />
  );
}

export function MenuHeader({ title, rightContent, borderless }: MenuHeaderProps) {
  return (
    <ScreenHeader
      left={
        <>
          <SidebarMenuToggle />
          {title && <ScreenTitle>{title}</ScreenTitle>}
        </>
      }
      right={rightContent}
      leftStyle={styles.left}
      borderless={borderless}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  leadingToggle: {
    marginLeft: {
      xs: 0,
      md: -theme.spacing[2],
    },
  },
  left: {
    gap: theme.spacing[2],
  },
  mobileMenuIcon: {
    width: MOBILE_MENU_LINE_WIDTH,
    height: 12,
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  desktopMenuIconSpace: {
    width: theme.iconSize.md,
    height: theme.iconSize.md,
  },
  mobileMenuLine: {
    width: MOBILE_MENU_LINE_WIDTH,
    height: MOBILE_MENU_LINE_HEIGHT,
    borderRadius: theme.borderRadius.full,
  },
  mobileMenuLineShort: {
    width: MOBILE_MENU_LINE_SHORT_WIDTH,
  },
}));
