import { type ReactNode, useCallback, useMemo, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import { ChevronRight, X } from "lucide-react-native";
import { isNative, isWeb } from "@/constants/platform";
import { useIsCompactFormFactor } from "@/constants/layout";
import type { AttachmentMetadata } from "@/attachments/types";
import { useAttachmentPreviewUrl } from "@/attachments/use-attachment-preview-url";
import { ToolCallDetailsContent } from "@/components/tool-call-details";
import { inlineUnistylesStyle } from "@/styles/unistyles-inline-style";
import type { Theme } from "@/styles/theme";

// Every attachment pill body — image thumbnail or labelled — renders at this
// height so mixed attachment trays line up.
const ATTACHMENT_CONTENT_HEIGHT = 48;
const EXPANDED_ACCESSIBILITY_STATE = { expanded: true } as const;
const COLLAPSED_ACCESSIBILITY_STATE = { expanded: false } as const;

function expandedAccessibilityState(isExpanded: boolean) {
  return isExpanded ? EXPANDED_ACCESSIBILITY_STATE : COLLAPSED_ACCESSIBILITY_STATE;
}

interface AttachmentExpansion {
  prompt: string;
  hasDetails: boolean;
  isExpanded: boolean;
  toggle: () => void;
  expandAccessibilityLabel: string;
  collapseAccessibilityLabel: string;
}

function useAttachmentExpansion(details: string | null | undefined): AttachmentExpansion {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const prompt = details?.trim() ?? "";
  const hasDetails = prompt.length > 0;
  const toggle = useCallback(() => {
    if (!hasDetails) {
      return;
    }
    setIsExpanded((current) => !current);
  }, [hasDetails]);
  return {
    prompt,
    hasDetails,
    isExpanded: hasDetails && isExpanded,
    toggle,
    expandAccessibilityLabel: t("message.attachments.showPrompt"),
    collapseAccessibilityLabel: t("message.attachments.hidePrompt"),
  };
}

interface AttachmentExpandToggleProps {
  isExpanded: boolean;
  expandAccessibilityLabel: string;
  collapseAccessibilityLabel: string;
  onToggle: () => void;
}

function AttachmentExpandToggle({
  isExpanded,
  expandAccessibilityLabel,
  collapseAccessibilityLabel,
  onToggle,
}: AttachmentExpandToggleProps) {
  const accessibilityLabel = isExpanded ? collapseAccessibilityLabel : expandAccessibilityLabel;
  const chevronStyle = useMemo(
    () => [
      styles.chevron,
      inlineUnistylesStyle({
        transform: isExpanded ? [{ rotate: "90deg" }] : [],
      }),
    ],
    [isExpanded],
  );
  return (
    <Pressable
      testID="attachment-expand-toggle"
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={expandedAccessibilityState(isExpanded)}
      accessibilityLabel={accessibilityLabel}
      style={styles.chevronButton}
      hitSlop={8}
    >
      <View style={chevronStyle}>
        <ThemedChevronRight size={12} uniProps={iconForegroundMutedMapping} />
      </View>
    </Pressable>
  );
}

function AttachmentPromptDetails({ text }: { text: string }) {
  const detail = useMemo(() => ({ type: "plain_text" as const, text }), [text]);
  return (
    <View style={styles.detailWrapper} testID="attachment-prompt-details">
      <ToolCallDetailsContent detail={detail} maxHeight={300} />
    </View>
  );
}

interface AttachmentChromeProps {
  onBodyPress?: () => void;
  bodyAccessibilityLabel?: string;
  details?: string | null;
  disabled?: boolean;
  testID?: string;
  children: ReactNode;
}

function AttachmentChrome({
  onBodyPress,
  bodyAccessibilityLabel,
  details,
  disabled = false,
  testID,
  children,
}: AttachmentChromeProps) {
  const expansion = useAttachmentExpansion(details);
  const handleBodyPress = onBodyPress ?? (expansion.hasDetails ? expansion.toggle : undefined);
  const isBodyExpandToggle = !onBodyPress && expansion.hasDetails;
  const wrapperStyle = useMemo(
    () => [styles.column, expansion.isExpanded && styles.columnExpanded],
    [expansion.isExpanded],
  );
  const frameStyle = useMemo(
    () => [styles.frame, expansion.isExpanded && styles.frameExpanded],
    [expansion.isExpanded],
  );
  const bodyStyle = useMemo(
    () => [expansion.isExpanded ? styles.bodyExpanded : null],
    [expansion.isExpanded],
  );
  const expandLabel = expansion.isExpanded
    ? expansion.collapseAccessibilityLabel
    : expansion.expandAccessibilityLabel;
  const bodyLabel = isBodyExpandToggle ? expandLabel : bodyAccessibilityLabel;
  const bodyAccessibilityState = isBodyExpandToggle
    ? expandedAccessibilityState(expansion.isExpanded)
    : undefined;

  const body = handleBodyPress ? (
    <Pressable
      testID={testID}
      onPress={handleBodyPress}
      disabled={disabled && !isBodyExpandToggle}
      accessibilityRole="button"
      accessibilityLabel={bodyLabel}
      accessibilityState={bodyAccessibilityState}
      style={bodyStyle}
    >
      {children}
    </Pressable>
  ) : (
    <View testID={testID} style={bodyStyle}>
      {children}
    </View>
  );

  return (
    <View style={wrapperStyle}>
      <View style={frameStyle}>
        {body}
        {expansion.hasDetails ? (
          <AttachmentExpandToggle
            isExpanded={expansion.isExpanded}
            expandAccessibilityLabel={expansion.expandAccessibilityLabel}
            collapseAccessibilityLabel={expansion.collapseAccessibilityLabel}
            onToggle={expansion.toggle}
          />
        ) : null}
      </View>
      {expansion.isExpanded ? <AttachmentPromptDetails text={expansion.prompt} /> : null}
    </View>
  );
}

interface AttachmentPillProps {
  onOpen?: () => void;
  onRemove: () => void;
  openAccessibilityLabel?: string;
  removeAccessibilityLabel: string;
  details?: string | null;
  disabled?: boolean;
  testID?: string;
  children: ReactNode;
}

export function AttachmentPill({
  onOpen,
  onRemove,
  openAccessibilityLabel,
  removeAccessibilityLabel,
  details,
  disabled = false,
  testID,
  children,
}: AttachmentPillProps) {
  const isCompact = useIsCompactFormFactor();
  const [isHovered, setIsHovered] = useState(false);
  const alwaysShow = isNative || isCompact;
  const showRemove = alwaysShow || isHovered;
  const closeButtonStyle = useMemo(
    () => [styles.closeButton, !showRemove && styles.closeButtonHidden],
    [showRemove],
  );
  const handleHoverIn = useCallback(() => setIsHovered(true), []);
  const handleHoverOut = useCallback(() => setIsHovered(false), []);
  return (
    <View
      style={styles.wrapper}
      onPointerEnter={isWeb ? handleHoverIn : undefined}
      onPointerLeave={isWeb ? handleHoverOut : undefined}
    >
      <AttachmentChrome
        onBodyPress={onOpen}
        bodyAccessibilityLabel={openAccessibilityLabel}
        details={details}
        disabled={disabled}
        testID={testID}
      >
        {children}
      </AttachmentChrome>
      <Pressable
        onPress={onRemove}
        disabled={disabled}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={removeAccessibilityLabel}
        style={closeButtonStyle}
      >
        <ThemedX size={12} uniProps={iconForegroundMutedMapping} />
      </Pressable>
    </View>
  );
}

interface AttachmentFrameProps {
  onPress?: () => void;
  accessibilityLabel?: string;
  details?: string | null;
  testID?: string;
  children: ReactNode;
}

/** Bare attachment frame for read-only surfaces (sent messages) — no remove button. */
export function AttachmentFrame({
  onPress,
  accessibilityLabel,
  details,
  testID,
  children,
}: AttachmentFrameProps) {
  return (
    <AttachmentChrome
      onBodyPress={onPress}
      bodyAccessibilityLabel={accessibilityLabel}
      details={details}
      testID={testID}
    >
      {children}
    </AttachmentChrome>
  );
}

interface AttachmentLabelProps {
  icon?: ReactNode;
  title: string;
  subtitle: string;
}

/** Two-line labelled pill body: attachment name over its type. */
export function AttachmentLabel({ icon, title, subtitle }: AttachmentLabelProps) {
  return (
    <View style={styles.labelBody}>
      {icon ? <View style={styles.labelIcon}>{icon}</View> : null}
      <View style={styles.labelTextColumn}>
        <Text style={styles.labelTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.labelSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

/** Square image preview pill body. */
export function AttachmentThumbnail({ metadata }: { metadata: AttachmentMetadata }) {
  const uri = useAttachmentPreviewUrl(metadata);
  const source = useMemo(() => ({ uri: uri ?? "" }), [uri]);
  if (!uri) {
    return <View style={styles.thumbnailPlaceholder} />;
  }
  return <Image source={source} style={styles.thumbnail} />;
}

const ThemedX = withUnistyles(X);
const ThemedChevronRight = withUnistyles(ChevronRight);
const iconForegroundMutedMapping = (theme: Theme) => ({ color: theme.colors.foregroundMuted });

const styles = StyleSheet.create((theme) => ({
  wrapper: {
    position: "relative",
  },
  column: {
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  columnExpanded: {
    alignSelf: "stretch",
    width: "100%",
  },
  frame: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: theme.borderRadius.md,
    borderWidth: theme.borderWidth[1],
    borderColor: theme.colors.borderAccent,
    overflow: "hidden",
    minWidth: 0,
  },
  frameExpanded: {
    alignSelf: "stretch",
    width: "100%",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface1,
  },
  bodyExpanded: {
    flex: 1,
    minWidth: 0,
  },
  chevronButton: {
    width: 28,
    height: ATTACHMENT_CONTENT_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chevron: {
    flexShrink: 0,
  },
  detailWrapper: {
    borderBottomLeftRadius: theme.borderRadius.md,
    borderBottomRightRadius: theme.borderRadius.md,
    borderWidth: theme.borderWidth[1],
    borderTopWidth: 0,
    borderColor: theme.colors.border,
    padding: 0,
    minWidth: 0,
    overflow: "hidden",
  },
  labelBody: {
    height: ATTACHMENT_CONTENT_HEIGHT,
    maxWidth: 260,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    backgroundColor: theme.colors.surface1,
  },
  labelIcon: {
    width: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  labelTextColumn: {
    minWidth: 0,
    flexShrink: 1,
  },
  labelTitle: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
  },
  labelSubtitle: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
  },
  thumbnail: {
    width: ATTACHMENT_CONTENT_HEIGHT,
    height: ATTACHMENT_CONTENT_HEIGHT,
  },
  thumbnailPlaceholder: {
    width: ATTACHMENT_CONTENT_HEIGHT,
    height: ATTACHMENT_CONTENT_HEIGHT,
    backgroundColor: theme.colors.surface1,
  },
  closeButton: {
    position: "absolute",
    top: -8,
    left: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.surface2,
    borderWidth: theme.borderWidth[1],
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  closeButtonHidden: {
    opacity: 0,
    pointerEvents: "none",
  },
}));
