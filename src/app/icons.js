/**
 * Lucide line icons (replacing the old unicode glyphs, which rendered differently on every phone).
 * Markup uses <i data-lucide="name"></i>; renderIcons() swaps those for inline SVGs.
 * Only the icons listed here are bundled.
 */
import {
  createIcons,
  Bell,
  Building2,
  ChartColumn,
  CircleCheck,
  Clock,
  CloudSun,
  Compass,
  Ellipsis,
  Handshake,
  House,
  Inbox,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Monitor,
  Moon,
  PiggyBank,
  Receipt,
  CalendarClock,
  Search,
  Settings,
  Smartphone,
  Sun,
  UserPlus,
  Users,
  Wallet,
  Zap
} from 'lucide';

const icons = {
  Bell,
  Building2,
  ChartColumn,
  CircleCheck,
  Clock,
  CloudSun,
  Compass,
  Ellipsis,
  Handshake,
  House,
  Inbox,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Monitor,
  Moon,
  PiggyBank,
  Receipt,
  CalendarClock,
  Search,
  Settings,
  Smartphone,
  Sun,
  UserPlus,
  Users,
  Wallet,
  Zap
};

/** Replace every pending <i data-lucide> in the document with its SVG. Safe to call again after re-renders. */
export function renderIcons() {
  createIcons({icons, attrs: {'aria-hidden': 'true', 'stroke-width': 2}});
}
