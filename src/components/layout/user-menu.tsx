"use client"

import { useState } from "react"
import { signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { LogOut, User, ChevronDown } from "lucide-react"
import { toast } from "sonner"

export function UserMenu() {
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  if (!session?.user) {
    return null
  }

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      await signOut({ callbackUrl: "/login" })
      toast.success("Logged out successfully")
    } catch (error) {
      toast.error("Failed to log out")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <User className="h-4 w-4" />
        <span className="hidden md:inline-block">
          {session.user.email}
        </span>
        <ChevronDown className="h-3 w-3" />
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-background shadow-lg z-50">
            <div className="p-3 border-b border-border">
              <p className="text-sm font-medium">{session.user.name || "Admin User"}</p>
              <p className="text-xs text-muted-foreground truncate">
                {session.user.email}
              </p>
            </div>
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleSignOut}
                disabled={isLoading}
              >
                <LogOut className="h-4 w-4" />
                {isLoading ? "Signing out..." : "Sign out"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
