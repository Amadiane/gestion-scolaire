import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import DashboardAdmin from './pages/admin/DashboardAdmin.jsx';
import Eleves from './pages/admin/Eleves.jsx';
import FicheEleve from './pages/admin/FicheEleve.jsx';

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
        <Route path="eleves" element={<Eleves />} />
        <Route path="eleves" element={<Eleves />} />
        <Route path="eleves/:id" element={<FicheEleve />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;