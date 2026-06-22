import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { AdminDashboard, IdentityPage, SystemHealthPage, CertificatePage } from './dashboards/admin';
import { InstitutionDashboard, InstitutionCredentialsPage, IssueCredentialPage } from './dashboards/institution';
import { StudentDashboard } from './dashboards/student';
import { EmployerDashboard } from './dashboards/employer';
import VerifyCredentialPage from './pages/VerifyCredentialPage';
import { SetupPage, GraduationSetupPage } from './pages/dev';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Routes>
      <Route path="/verify/:credentialId" element={<VerifyCredentialPage />} />
      <Route
        path="/*"
        element={
          <Layout currentPath={location.pathname} navigate={navigate}>
            <Routes>
              <Route path="/" element={<AdminDashboard />} />
              <Route path="/identity" element={<IdentityPage />} />
              <Route path="/health" element={<SystemHealthPage />} />
              <Route path="/certificates" element={<CertificatePage />} />
              <Route path="/institution/dashboard" element={<InstitutionDashboard />} />
              <Route path="/institution/credentials" element={<InstitutionCredentialsPage />} />
              <Route path="/institution/issue" element={<IssueCredentialPage />} />
              <Route path="/institution" element={<InstitutionDashboard />} />
              <Route path="/student" element={<StudentDashboard />} />
              <Route path="/employer" element={<EmployerDashboard />} />
              <Route path="/dev/setup" element={<SetupPage />} />
              <Route path="/dev/graduation" element={<GraduationSetupPage />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}