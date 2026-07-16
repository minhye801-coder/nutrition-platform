import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '@/layouts/RootLayout'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { SetupPage } from '@/pages/SetupPage'
import { AppPage } from '@/pages/AppPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { StudentsPage } from '@/pages/StudentsPage'
import { PublicIntakePage } from '@/pages/PublicIntakePage'
import { IntakesPage } from '@/pages/IntakesPage'
import { IntakeDetailPage } from '@/pages/IntakeDetailPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'setup', element: <SetupPage /> },
      { path: 'app', element: <AppPage /> },
      { path: 'intakes', element: <IntakesPage /> },
      { path: 'intakes/:intakeId', element: <IntakeDetailPage /> },
      { path: 'intake/:schoolPublicId', element: <PublicIntakePage /> },
      { path: 'students', element: <StudentsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
