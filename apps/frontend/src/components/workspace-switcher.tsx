"use client"

import { Check, ChevronsUpDown, GalleryVerticalEnd } from "lucide-react"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useEffect, useState } from "react";

export function WorkspaceSwitcher() {
    const workspaces = ["Programming vs Zuzu", "Gebeta Maps Space"];
    const [selectedWorkspace, setSelectedWorkspace] = useState(workspaces[0])


    useEffect(() => {
        console.log({ selectedWorkspace })
    }, [selectedWorkspace])
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[#8E8B86] text-sidebar-primary-foreground">
                                <span>{selectedWorkspace.charAt(0)}</span>
                            </div>
                            <span className="">{selectedWorkspace}</span>
                            <ChevronsUpDown className="ml-auto" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-(--radix-dropdown-menu-trigger-width)"
                        align="start"
                    >
                        {workspaces.map((workspace) => (
                            <DropdownMenuItem
                                key={workspace}
                                onClick={() => setSelectedWorkspace(workspace)}
                            >
                                {workspace}{" "}
                                {workspace === selectedWorkspace && <Check className="ml-auto" />}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
