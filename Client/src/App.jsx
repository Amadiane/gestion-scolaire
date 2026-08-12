import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import DashboardAdmin from './pages/admin/DashboardAdmin.jsx';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('access');
  return token ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/dashboardAdmin"
        element={
          <PrivateRoute>
            <AdminLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<DashboardAdmin />} />
        {/* Les futures pages (Eleves, Classes, Notes, Bulletins) viendront ici */}
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;