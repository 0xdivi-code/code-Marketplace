/**
 * Category glyphs.
 *
 * Each category row stores a lucide icon name in its `glyph` column, so an
 * editor adding a category can pick an icon without a code change. The map is
 * explicit rather than a dynamic import so every icon stays tree-shaken and a
 * typo falls back to a sensible default instead of crashing the menu.
 */
import type { LucideIcon } from "lucide-react";
import {
  Layers,
  LayoutDashboard,
  Component,
  Server,
  KeyRound,
  Smartphone,
  Terminal,
  Gift,
  Boxes,
  Code2,
  Cpu,
  Database,
  FileCode2,
  Frame,
  Gamepad2,
  Globe,
  GraduationCap,
  Headphones,
  Image as ImageIcon,
  LayoutTemplate,
  LineChart,
  Lock,
  Mail,
  Megaphone,
  MonitorSmartphone,
  NotebookPen,
  Package,
  Palette,
  PenTool,
  Plug,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Table,
  Tags,
  Type,
  Wand2,
  Workflow,
  Zap,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  layers: Layers,
  "layout-dashboard": LayoutDashboard,
  "layout-template": LayoutTemplate,
  component: Component,
  server: Server,
  "key-round": KeyRound,
  smartphone: Smartphone,
  terminal: Terminal,
  gift: Gift,
  boxes: Boxes,
  "code-2": Code2,
  cpu: Cpu,
  database: Database,
  "file-code": FileCode2,
  frame: Frame,
  gamepad: Gamepad2,
  globe: Globe,
  "graduation-cap": GraduationCap,
  headphones: Headphones,
  image: ImageIcon,
  "line-chart": LineChart,
  lock: Lock,
  mail: Mail,
  megaphone: Megaphone,
  "monitor-smartphone": MonitorSmartphone,
  "notebook-pen": NotebookPen,
  package: Package,
  palette: Palette,
  "pen-tool": PenTool,
  plug: Plug,
  rocket: Rocket,
  search: Search,
  settings: Settings,
  "shield-check": ShieldCheck,
  "shopping-bag": ShoppingBag,
  sparkles: Sparkles,
  star: Star,
  table: Table,
  tags: Tags,
  type: Type,
  "wand-2": Wand2,
  workflow: Workflow,
  zap: Zap,
};

/** Every glyph name an editor can choose from, alphabetically. */
export const CATEGORY_GLYPHS = Object.keys(ICONS).sort();

export function categoryIcon(glyph?: string | null): LucideIcon {
  if (!glyph) return Layers;
  return ICONS[glyph] ?? Layers;
}

/** Renders the icon for a category glyph, falling back to `Layers`. */
export function CategoryGlyph({
  glyph,
  className,
  strokeWidth = 1.6,
}: {
  glyph?: string | null;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = categoryIcon(glyph);
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden />;
}
