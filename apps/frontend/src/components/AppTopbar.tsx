import { SidebarTrigger, useSidebar } from "./ui/sidebar";

export function AppTopbar() {
    const { open, toggleSidebar } = useSidebar();

    return (
        <div className="mt-2">
            {!open && <SidebarTrigger />}
        </div>
    )
}