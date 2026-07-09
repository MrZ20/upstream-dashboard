import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { ProjectProvider } from '../domain/projectStore';
import AppLayout from '../layout/AppLayout';
import OverviewPage from '../features/overview/OverviewPage';
import SoftwareListPage from '../features/software-list/SoftwareListPage';
import { theme } from './theme';
import '../styles/global.css';

export default function App() {
  return (
    <ProjectProvider>
      <ConfigProvider locale={zhCN} theme={theme}>
        <AntApp>
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/overview" replace />} />
                <Route path="/overview" element={<OverviewPage />} />
                <Route path="/software/kunpeng" element={<SoftwareListPage />} />
                <Route path="/software/ascend" element={<SoftwareListPage />} />
                <Route path="*" element={<Navigate to="/overview" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </ProjectProvider>
  );
}
