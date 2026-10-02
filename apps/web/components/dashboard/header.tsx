"use client";

import { Bell, Sun, Moon, Monitor, Sparkles } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Session } from "next-auth";
import Link from "next/link";

interface DashboardHeaderProps {
  user?: Session["user"];
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const { setTheme } = useTheme();

  return (
    <header className="h-16 border-b flex items-center justify-between px-6 bg-background/80 backdrop-blur-sm flex-shrink-0">
      {/* Left side spacer */}
      <div />

      {/* Right side */}
      <div className="flex items-center gap-1.5">
        {/* Theme toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="mr-2 h-4 w-4" /> Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="mr-2 h-4 w-4" /> Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor className="mr-2 h-4 w-4" /> System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Bell className="h-4 w-4" />
        </Button>

        {/* Upgrade Button */}
        <Button
          size="sm"
          asChild
          className="h-8 gap-1.5 text-xs font-semibold px-3 ml-2 shadow-sm"
        >
          <Link href="/billing">
            <Sparkles className="h-3.5 w-3.5" />
            Upgrade
          </Link>
        </Button>
      </div>
    </header>
  );
}
