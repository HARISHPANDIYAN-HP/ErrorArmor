import { Link, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import { Login, Register } from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import NewScan from './pages/NewScan.jsx';
import ScanProgress from './pages/ScanProgress.jsx';
import ScanResults from './pages/ScanResults.jsx';
import History, { Compare } from './pages/History.jsx';
import SettingsPage from './pages/Settings.jsx';
import SampleReport from './pages/SampleReport.jsx';

const NotFound = () => (
  <div className="grid min-h-screen place-items-center p-6 text-center">
    <div><h1 className="text-4xl font-semibold">404</h1><p className="mt-2 muted">That page does not exist.</p><Link to="/" className="btn-primary mt-4">Back to home</Link></div>
  </div>
);

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/sample" element={<SampleReport />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/app" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="new" element={<NewScan />} />
        <Route path="scans" element={<History />} />
        <Route path="compare" element={<Compare />} />
        <Route path="scans/:scanId/progress" element={<ScanProgress />} />
        <Route path="scans/:scanId" element={<ScanResults />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
