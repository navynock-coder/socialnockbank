import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
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
              <Route path="/dna" element={<SchoolDnaPage />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
