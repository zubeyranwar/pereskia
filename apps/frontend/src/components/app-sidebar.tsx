import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger
} from "@/components/ui/sidebar"
import { WorkspaceSwitcher } from "./workspace-switcher"
import { SearchInput } from "./SearchInput"

const documents = ["Ngnix Setup", "Docker Issue","Integration Testing"]

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarTrigger />
        <SearchInput />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Documents</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {documents.map((item) => (
                <SidebarMenuItem key={item}>
                  <SidebarMenuButton asChild>
                    <a href={item}>{item}</a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup />
      </SidebarContent>
      <SidebarFooter>
        <WorkspaceSwitcher />
      </SidebarFooter>
    </Sidebar>
  )
}