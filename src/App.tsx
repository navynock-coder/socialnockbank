import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { GradeLevelProvider } from '@/contexts/GradeLevelContext'
import { ToastProvider } from '@/components/ui/toast'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import ItemBankPage from '@/pages/ItemBankPage'
import ImportPage from '@/pages/ImportPage'
import PaperGeneratorPage from '@/pages/PaperGeneratorPage'
import PrintViewPage from '@/pages/PrintViewPage'
import SchoolDnaPage from '@/pages/SchoolDnaPage'
import ExportExamPage from '@/pages/ExportExamPage'
import ExamStudioPage from '@/pages/ExamStudioPage'
import GatePage from '@/pages/GatePage'
import GateResultsPage from '@/pages/GateResultsPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GradeLevelProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            {/* ประตูจับเวลา — เปิดสาธารณะ ไม่ต้องล็อกอิน (ตรวจสิทธิ์ด้วยรหัสผ่านฟังก์ชัน gate_* ใน Supabase) */}
            <Route path="/gate" element={<GatePage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<DashboardPage />} />
              <Route path="/items" element={<ItemBankPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/generator" element={<PaperGeneratorPage />} />
              <Route path="/print" element={<PrintViewPage />} />
              <Route path="/export" element={<ExportExamPage />} />
              <Route path="/dna" element={<SchoolDnaPage />} />
              <Route path="/studio" element={<ExamStudioPage />} />
              <Route path="/gate-results" element={<GateResultsPage />} />
            </Route>
          </Routes>
        </ToastProvider>
        </GradeLevelProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
