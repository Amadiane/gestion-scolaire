import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import DashboardAdmin from './pages/admin/DashboardAdmin.jsx';
import Eleves from './pages/admin/Eleves.jsx';
import FicheEleve from './pages/admin/FicheEleve.jsx';
import Classes from './pages/admin/Classes.jsx';
import RosterClasse from './pages/admin/RosterClasse.jsx';
import Parents from './pages/admin/Parents.jsx';
import FicheParent from './pages/admin/FicheParent.jsx';
import Notes from './pages/admin/Notes.jsx';
import Bulletins from './pages/admin/Bulletins.jsx';
import AnneesScolaires from './pages/admin/AnneesScolaires.jsx';
import FicheAnneeScolaire from './pages/admin/FicheAnneeScolaire.jsx';
import Utilisateurs from './pages/admin/Utilisateurs.jsx';
import Finance from './pages/admin/Finance.jsx';
import Affectations from './pages/admin/Affectations.jsx';
import EnseignantLayout from './layouts/EnseignantLayout.jsx';
import DashboardEnseignant from './pages/enseignant/DashboardEnseignant.jsx';
import MesClasses from './pages/enseignant/MesClasses.jsx';
import NotesEnseignant from './pages/enseignant/NotesEnseignant.jsx';
import Sylium from './pages/sylium/Sylium.jsx';

const ROLES_ADMIN = ['directeur', 'secretaire', 'comptable', 'surveillant'];
const ACCUEIL = { enseignant: '/enseignant' };
ROLES_ADMIN.forEach((r) => { ACCUEIL[r] = '/dashboardAdmin'; });

// Le contrôle réel est fait par l'API ; ceci évite d'afficher des pages vides.
const PrivateRoute = ({ children, roles, superuser }) => {
  const token = localStorage.getItem('access');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (!token) return <Navigate to="/login" replace />;

  if (superuser) {
    return user.is_superuser ? children : <Navigate to={ACCUEIL[user.role] || '/login'} replace />;
  }
  if (user.is_superuser) return <Navigate to="/sylium" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={ACCUEIL[user.role] || '/login'} replace />;
  }
  return children;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/sylium"
        element={
          <PrivateRoute superuser>
            <Sylium />
          </PrivateRoute>
        }
      />

      <Route
        path="/dashboardAdmin"
        element={
          <PrivateRoute roles={ROLES_ADMIN}>
            <AdminLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<DashboardAdmin />} />
        <Route path="eleves" element={<Eleves />} />
        <Route path="eleves/:id" element={<FicheEleve />} />
        <Route path="classes" element={<Classes />} />
        <Route path="classes/:id" element={<RosterClasse />} />
        <Route path="parents" element={<Parents />} />
        <Route path="parents/:id" element={<FicheParent />} />
        <Route path="notes" element={<Notes />} />
        <Route path="bulletins" element={<Bulletins />} />
        <Route path="finance" element={<Finance />} />
        <Route path="annees-scolaires" element={<AnneesScolaires />} />
        <Route path="annees-scolaires/:id" element={<FicheAnneeScolaire />} />
        <Route path="utilisateurs" element={<Utilisateurs />} />
        <Route path="affectations" element={<Affectations />} />
      </Route>

      <Route
        path="/enseignant"
        element={
          <PrivateRoute roles={['enseignant']}>
            <EnseignantLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<DashboardEnseignant />} />
        <Route path="mes-classes" element={<MesClasses />} />
        <Route path="notes" element={<NotesEnseignant />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;