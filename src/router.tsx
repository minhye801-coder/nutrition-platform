import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '@/layouts/RootLayout'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { SetupPage } from '@/pages/SetupPage'
import { AppPage } from '@/pages/AppPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { StudentsPage } from '@/pages/StudentsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'setup', element: <SetupPage /> },
      { path: 'app', element: <AppPage /> },
      { path: 'students', element: <StudentsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
