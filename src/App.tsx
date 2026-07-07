import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AuthProvider } from './contexts/AuthContext';
import { ProjectProvider } from './contexts/ProjectContext';
import AppLayout from './components/Layout';
import Overview from './pages/Overview';
import SoftwareList from './pages/SoftwareList';
import AdminSettings from './pages/AdminSettings';
import './styles/global.css';

const theme = {
  token: {
    colorPrimary: '#2563EB',
    colorSuccess: '#16A34A',
    colorWarning: '#D97706',
    colorError: '#DC2626',
    colorInfo: '#2563EB',
    borderRadius: 6,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif',
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f3f4f6',
  },
};

export default function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <ConfigProvider locale={zhCN} theme={theme}>
          <AntApp>
            <BrowserRouter>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Navigate to="/overview" replace />} />
                  <Route path="/overview" element={<Overview />} />
                  <Route path="/software/kunpeng" element={<SoftwareList />} />
                  <Route path="/software/ascend" element={<SoftwareList />} />
                  <Route path="/admin/settings" element={<AdminSettings />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </AntApp>
        </ConfigProvider>
      </ProjectProvider>
    </AuthProvider>
  );
}
