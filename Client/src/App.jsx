import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import DashboardAdmin from './pages/admin/DashboardAdmin.jsx';
import Eleves from './pages/admin/Eleves.jsx';
import FicheEleve from './pages/admin/FicheEleve.jsx';
import Classes from './pages/admin/Classes.jsx';
import RosterClasse from './pages/admin/RosterClasse.jsx';
import Parents from './pages/admin/Parents.jsx';
import Notes from './pages/admin/Notes.jsx';
import Bulletins from './pages/admin/Bulletins.jsx';
import FicheParent from './pages/admin/FicheParent.jsx';
import AnneesScolaires from './pages/admin/AnneesScolaires.jsx';
import FicheAnneeScolaire from './pages/admin/FicheAnneeScolaire.jsx';
import Utilisateurs from './pages/admin/Utilisateurs.jsx';
import DashboardEnseignant from './pages/enseignant/DashboardEnseignant.jsx';
import EnseignantLayout from './layouts/EnseignantLayout.jsx';


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
        <Route path="classes" element={<Classes />} />
        <Route path="classes/:id" element={<RosterClasse />} />
        <Route path="parents" element={<Parents />} />
        <Route path="notes" element={<Notes />} />
        <Route path="bulletins" element={<Bulletins />} />
        <Route path="parents/:id" element={<FicheParent />} />
        <Route path="annees-scolaires" element={<AnneesScolaires />} />
        <Route path="annees-scolaires/:id" element={<FicheAnneeScolaire />} />
        <Route path="utilisateurs" element={<Utilisateurs />} />
      </Route>

      <Route
        path="/enseignant"
        element={
          <PrivateRoute>
            <EnseignantLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<DashboardEnseignant />} />
        {/* futures pages : mes-classes, notes */}
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;