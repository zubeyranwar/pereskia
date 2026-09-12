import { AppSidebar } from "./components/app-sidebar"
import { AppTopbar } from "./components/AppTopbar"
import { Content } from "./components/content"
import { SidebarProvider } from "./components/ui/sidebar"

export function App() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main>
        <AppTopbar />
        <Content />
      </main>
    </SidebarProvider>
  )
}

export default App
