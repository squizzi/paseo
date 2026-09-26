import { useLayoutEffect, useMemo, useRef } from "react";
import { PanelRight } from "lucide-react-native";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { withUnistyles } from "react-native-unistyles";
import { HeaderToggleButton } from "@/components/headers/header-toggle-button";
import {
  extraMutedIconColorMapping,
  iconButtonChromeGlyphSize,
  mutedIconColorMapping,
} from "@/components/ui/icon-button-chrome";
import { HEADER_CONTROL_HEIGHT } from "@/components/ui/control-geometry";
import { isWeb } from "@/constants/platform";
import {
  MOTION_ARRIVE_CSS,
  MOTION_ARRIVE_DURATION_MS,
  MOTION_EXIT_CSS,
  MOTION_EXIT_DURATION_MS,
} from "@/styles/motion-tokens";
import { inlineUnistylesStyle } from "@/styles/unistyles-inline-style";
import type { ShortcutKey } from "@/utils/format-shortcut";

const ThemedPanelRight = withUnistyles(PanelRight);

interface WorkspaceExplorerToggleProps {
  onPress: () => void;
  label: string;
  tooltipLabel: string;
  tooltipKeys: ShortcutKey[];
  accessibilityState: { expanded: boolean };
  mobile: boolean;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export type WorkspaceExplorerToggleOwner = "mobile" | "header" | "window";

export function resolveWorkspaceExplorerToggleOwner({
  isMobile,
  hasMacTrafficLights,
}: {
  isMobile: boolean;
  hasMacTrafficLights: boolean;
}): WorkspaceExplorerToggleOwner {
  if (isMobile) return "mobile";
  return hasMacTrafficLights ? "window" : "header";
}

export function WorkspaceExplorerToggle({
  onPress,
  label,
  tooltipLabel,
  tooltipKeys,
  accessibilityState,
  mobile,
  style,
  disabled,
}: WorkspaceExplorerToggleProps) {
  return (
    <HeaderToggleButton
      testID="workspace-explorer-toggle"
      onPress={onPress}
      tooltipLabel={tooltipLabel}
      tooltipKeys={tooltipKeys}
      tooltipSide="left"
      style={style}
      disabled={disabled}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={accessibilityState}
    >
      <ThemedPanelRight
        size={iconButtonChromeGlyphSize("large")}
        strokeWidth={1.5}
        uniProps={mobile ? mutedIconColorMapping : extraMutedIconColorMapping}
      />
    </HeaderToggleButton>
  );
}

interface DesktopWorkspaceExplorerToggleProps extends Omit<WorkspaceExplorerToggleProps, "mobile"> {
  owner: WorkspaceExplorerToggleOwner;
}

export function WorkspaceHeaderExplorerToggle({
  owner,
  accessibilityState,
  style,
  ...toggleProps
}: DesktopWorkspaceExplorerToggleProps) {
  const visible = owner !== "mobile" && (owner !== "window" || !accessibilityState.expanded);
  const previousVisibleRef = useRef<boolean | null>(null);

  const transitionStyle = useMemo(() => {
    const prev = previousVisibleRef.current;
    if (!isWeb || prev === null) {
      return null;
    }
    // Growing (panel closing) -> matches panel exit timing
    // Shrinking (panel opening) -> matches panel arrive timing
    const duration = visible ? MOTION_EXIT_DURATION_MS : MOTION_ARRIVE_DURATION_MS;
    const timing = visible ? MOTION_EXIT_CSS : MOTION_ARRIVE_CSS;
    return `width ${duration}ms ${timing}, opacity ${duration}ms ${timing}`;
  }, [visible]);

  useLayoutEffect(() => {
    previousVisibleRef.current = visible;
  }, [visible]);

  const wrapperStyle = useMemo(() => {
    const slotStyle = visible
      ? { width: HEADER_CONTROL_HEIGHT, opacity: 1, overflow: "hidden" as const }
      : { width: 0, opacity: 0, overflow: "hidden" as const };
    return [
      style,
      slotStyle,
      transitionStyle ? inlineUnistylesStyle({ transition: transitionStyle } as ViewStyle) : null,
    ];
  }, [style, transitionStyle, visible]);

  if (owner === "mobile") return null;

  if (owner !== "window") {
    return (
      <WorkspaceExplorerToggle
        {...toggleProps}
        accessibilityState={accessibilityState}
        mobile={false}
        style={style}
      />
    );
  }

  return (
    <View
      pointerEvents={visible ? undefined : "none"}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      style={wrapperStyle}
    >
      <WorkspaceExplorerToggle
        {...toggleProps}
        disabled={!visible}
        accessibilityState={accessibilityState}
        mobile={false}
      />
    </View>
  );
}

export function WorkspaceExplorerSidebarToggle({
  owner,
  ...toggleProps
}: DesktopWorkspaceExplorerToggleProps) {
  if (owner !== "window") return null;
  return <WorkspaceExplorerToggle {...toggleProps} mobile={false} />;
}
