import Svg, { Circle, Line } from "react-native-svg";

interface GitMergeQueueIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * GitHub's merge-queue glyph in Lucide stroke language: three stacked nodes
 * with waiting lines, so it sits next to GitPullRequest / GitMerge at the same size.
 */
export function GitMergeQueueIcon({
  size = 16,
  color = "currentColor",
  strokeWidth = 2,
}: GitMergeQueueIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={6} cy={6} r={2.5} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={6} cy={12} r={2.5} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={6} cy={18} r={2.5} stroke={color} strokeWidth={strokeWidth} />
      <Line
        x1={12}
        y1={6}
        x2={20}
        y2={6}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={12}
        y1={12}
        x2={20}
        y2={12}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={12}
        y1={18}
        x2={20}
        y2={18}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}
