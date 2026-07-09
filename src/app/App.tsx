import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from '../layout/AppLayout';
import OverviewPage from '../pages/overview/OverviewPage';
import SoftwareListPage from '../pages/software/SoftwareListPage';
import { theme } from './theme';
import '../styles/global.css';
import '../styles/layout.css';
import '../styles/table.css';
import '../styles/overview.css';

export default function App() {
  return (
    <ConfigProvider locale={zhCN} theme={theme}>
      <AntApp>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
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
  );
}
