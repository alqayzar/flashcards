import { useHashRoute, parseRoute } from "@/lib/useHashRoute"
import { HomePage } from "@/pages/HomePage"
import { FolderPage } from "@/pages/FolderPage"
import { SettingsPage } from "@/pages/SettingsPage"

export default function App() {
  const hash = useHashRoute()
  const route = parseRoute(hash)

  return (
    <div className="min-h-screen">
      {route.name === "folder" ? (
        <FolderPage key={route.folderId} folderId={route.folderId} />
      ) : route.name === "settings" ? (
        <SettingsPage />
      ) : (
        <HomePage />
      )}
    </div>
  )
}
