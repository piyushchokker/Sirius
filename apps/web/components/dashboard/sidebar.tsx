"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import type { Session } from "next-auth";
import {
  LayoutDashboard, MessageSquare, Settings, CreditCard,
  Key, Users, Bot, FileText, BarChart2, LogOut,
  Sparkles, ChevronRight, Zap, PenLine, Cpu, ChevronsUpDown,
  Search,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function formatRole(role?: string) {
  if (!role) return "User";
  const upper = role.toUpperCase();
  if (upper === "SUPER_ADMIN") return "Owner";
  if (upper === "ADMIN") return "Admin";
  if (upper === "OWNER") return "Owner";
  if (upper === "USER") return "User";
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase().replace(/_/g, " ");
}

const SEARCH_ITEMS = [
  { href: "/chat", label: "AI Chat", description: "Chat with AI models", icon: MessageSquare },
  { href: "/dashboard", label: "Dashboard", description: "Analytics & overview", icon: LayoutDashboard },
  { href: "/agents", label: "AI Agents", description: "Autonomous AI agents", icon: Bot },
  { href: "/content", label: "Content Studio", description: "AI content generator", icon: PenLine },
  { href: "/automation", label: "Automation", description: "Workflows & integrations", icon: Zap },
  { href: "/playground", label: "Playground", description: "Test prompts & models", icon: Sparkles },
  { href: "/files", label: "Knowledge Base", description: "Document vector store", icon: FileText },
  { href: "/settings", label: "Settings", description: "Account & preferences", icon: Settings },
  { href: "/billing", label: "Billing", description: "Plans & subscriptions", icon: CreditCard },
  { href: "/team", label: "Team", description: "Manage team members", icon: Users },
  { href: "/api-keys", label: "API Keys", description: "API credentials", icon: Key },
];

const MAIN_NAV_ITEMS = [
  { href: "/chat", label: "AI Chat", icon: MessageSquare },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

const TOOL_ITEMS = [
  { href: "/agents", label: "AI Agents", icon: Bot },
  { href: "/content", label: "Content Studio", icon: PenLine },
  { href: "/automation", label: "Automation", icon: Zap },
  { href: "/playground", label: "Playground", icon: Sparkles },
  { href: "/files", label: "Knowledge Base", icon: FileText },
];

const ADMIN_ITEMS = [
  { href: "/admin", label: "Overview", icon: BarChart2 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
];

interface SidebarProps {
  isAdmin?: boolean;
  user?: Session["user"];
}

export function Sidebar({ isAdmin, user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const currentUser = user ?? session?.user;
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredSearch = SEARCH_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function NavItem({
    href,
    label,
    icon: Icon,
  }: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }) {
    const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
    return (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.97]",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        )}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1">{label}</span>
        {active && <ChevronRight className="h-3 w-3 opacity-40" />}
      </Link>
    );
  }

  return (
    <>
      <div className="flex h-full w-56 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-shrink-0">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2.5 px-4 border-b border-sidebar-border flex-shrink-0">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-sidebar-foreground truncate" suppressHydrationWarning>
            {process.env.NEXT_PUBLIC_APP_NAME ?? "Sirius"}
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          <div className="space-y-0.5">
            {/* 1. Search */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-150 active:scale-[0.97]"
            >
              <Search className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1 text-left">Search</span>
              <kbd className="inline-flex h-4 select-none items-center gap-0.5 rounded border border-sidebar-border bg-sidebar-accent/50 px-1.5 font-mono text-[10px] font-medium text-sidebar-foreground/50">
                ⌘K
              </kbd>
            </button>

            {/* 2. AI Chat, 3. Dashboard */}
            {MAIN_NAV_ITEMS.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>

          <div className="space-y-0.5">
            <p className="px-3 text-[10px] font-semibold text-sidebar-foreground/35 uppercase tracking-widest mb-1">
              AI Tools
            </p>
            {TOOL_ITEMS.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>

          {isAdmin && (
            <div className="space-y-0.5">
              <Separator className="bg-sidebar-border mb-3" />
              <p className="px-3 text-[10px] font-semibold text-sidebar-foreground/35 uppercase tracking-widest mb-1">
                Admin
              </p>
              {ADMIN_ITEMS.map((item) => (
                <NavItem key={item.href} {...item} />
              ))}
            </div>
          )}
        </nav>

        {/* Profile at bottom left */}
        <div className="p-2 border-t border-sidebar-border flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left hover:bg-sidebar-accent/50 transition-all duration-150 active:scale-[0.98] outline-none">
                <Avatar className="h-8 w-8 flex-shrink-0 border border-sidebar-border">
                  <AvatarImage src={currentUser?.image ?? ""} alt={currentUser?.name ?? ""} />
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">
                    {getInitials(currentUser?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-sidebar-foreground truncate leading-tight">
                    {currentUser?.name || "Account"}
                  </p>
                  <p className="text-[11px] text-sidebar-foreground/60 truncate leading-tight mt-0.5">
                    {formatRole(currentUser?.role)}
                  </p>
                </div>
                <ChevronsUpDown className="h-4 w-4 text-sidebar-foreground/40 flex-shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56 mb-1 shadow-lg">
              <div className="px-2.5 py-2 border-b">
                <p className="text-sm font-semibold truncate">{currentUser?.name}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{currentUser?.email}</p>
              </div>
              <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/billing" className="flex items-center gap-2 cursor-pointer">
                <CreditCard className="h-4 w-4" />
                Billing
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/team" className="flex items-center gap-2 cursor-pointer">
                <Users className="h-4 w-4" />
                Team
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/api-keys" className="flex items-center gap-2 cursor-pointer">
                <Key className="h-4 w-4" />
                API Keys
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    {/* Quick Search Dialog */}
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0 [&>button:last-child]:focus:ring-0 [&>button:last-child]:focus:outline-none [&>button:last-child]:ring-offset-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Search Navigation</DialogTitle>
        </DialogHeader>
        <div className="flex items-center px-4 border-b">
          <Search className="h-4 w-4 text-muted-foreground mr-2.5 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pages and features..."
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            className="w-full bg-transparent border-0 outline-none ring-0 shadow-none text-sm h-12 pr-8 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus:border-0 focus-visible:outline-none focus-visible:ring-0"
            style={{ outline: "none", boxShadow: "none", border: "none" }}
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredSearch.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No results found for &ldquo;{searchQuery}&rdquo;
            </p>
          ) : (
            filteredSearch.map((item) => {
              const ItemIcon = item.icon;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery("");
                    router.push(item.href);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
                >
                  <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                    <ItemIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-50 flex-shrink-0" />
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
}
