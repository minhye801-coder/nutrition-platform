import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '@/layouts/RootLayout'
import { AppShellLayout } from '@/layouts/AppShellLayout'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { SetupPage } from '@/pages/SetupPage'
import { AppPage } from '@/pages/AppPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { StudentsPage } from '@/pages/StudentsPage'
import { PublicIntakePage } from '@/pages/PublicIntakePage'
import { IntakesPage } from '@/pages/IntakesPage'
import { IntakeDetailPage } from '@/pages/IntakeDetailPage'
import { ComingSoonPage } from '@/pages/ComingSoonPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'setup', element: <SetupPage /> },
      { path: 'intake/:schoolPublicId', element: <PublicIntakePage /> },
    ],
  },
  {
    element: <AppShellLayout />,
    children: [
      { path: 'app', element: <AppPage /> },
      { path: 'intakes', element: <IntakesPage /> },
      { path: 'intakes/:intakeId', element: <IntakeDetailPage /> },
      { path: 'students', element: <StudentsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'consents', element: <ComingSoonPage title="보호자 동의 관리" /> },
      { path: 'diagnosis', element: <ComingSoonPage title="공식 진단 PDF" /> },
      { path: 'sessions', element: <ComingSoonPage title="상담 기록" /> },
      { path: 'preparation', element: <ComingSoonPage title="다음 회기 준비" /> },
      { path: 'neis', element: <ComingSoonPage title="NEIS 업로드" /> },
      { path: 'evaluation', element: <ComingSoonPage title="효과평가·성장" /> },
      { path: 'cleanup', element: <ComingSoonPage title="테스트 데이터 정리" /> },
      { path: 'official-diagnosis', element: <ComingSoonPage title="교육부 진단프로그램" /> },
    ],
  },
])
