import {
  LayoutDashboard,
  MessagesSquare,
  Users,
  Target,
  Clock,
  BarChart3,
  Plug,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItemConfig = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const navItems: NavItemConfig[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Conversations", href: "/dashboard/conversations", icon: MessagesSquare },
  { label: "Customers", href: "/dashboard/customers", icon: Users },
  { label: "Leads", href: "/dashboard/leads", icon: Target },
  { label: "Follow-ups", href: "/dashboard/follow-ups", icon: Clock },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Channels", href: "/dashboard/channels", icon: Plug },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];
