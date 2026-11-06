import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, MapPin, GraduationCap } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import styles from '../../theme/pages/admin/FicheParent.module.css';

const TYPE_LIEN_LABEL = { pere: 'Père', mere: 'Mère', tuteur: 'Tuteur légal', autre: 'Autre' };

const comparer = (a, b) =>
  String(a || '').localeCompare(String(b || ''), 'fr', { numeric: true, sensitivity: 'base' });

const FicheParent = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [parent, setParent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const charger = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`${CONFIG.API_PARENTS}${id}/`);
        setParent(res.data);
      } catch (err) {
        setError(
          err.response?.status === 404
            ? "Ce parent n'existe pas ou n'appartient pas à votre école."
            : "Impossible de charger la fiche de ce parent."
        );
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, [id]);

  if (loading) return <div className={styles.wrapper}><p className={styles.stateMsg}>Chargement...</p></div>;
  if (error) {
    return (
      <div className={styles.wrapper}>
        <button className={styles.backButton} onClick={() => navigate('/dashboardAdmin/parents')}>
          <ArrowLeft size={16} /> Retour à la liste
        </button>
        <p className={styles.errorMsg}>{error}</p>
      </div>
    );
  }
  if (!parent) return null;

  // Contact principal d'abord, puis ordre de matricule.
  const enfants = [...(parent.enfants || [])].sort(
    (a, b) =>
      Number(Boolean(b.contact_principal)) - Number(Boolean(a.contact_principal)) ||
      comparer(a.matricule, b.matricule)
  );

  return (
    <div className={styles.wrapper}>
      <button className={styles.backButton} onClick={() => navigate('/dashboardAdmin/parents')}>
        <ArrowLeft size={16} /> Retour à la liste
      </button>

      <div className={styles.headerCard}>
        <div className={styles.avatar}>{parent.prenom?.[0]}{parent.nom?.[0]}</div>
        <div className={styles.headerInfo}>
          <h1 className={styles.name}>{parent.prenom} {parent.nom}</h1>
          <div className={styles.contactRow}>
            {parent.telephone && (
              <a className={styles.contactItem} href={`tel:${String(parent.telephone).replace(/\s+/g, '')}`}>
                <Phone size={13} /> {parent.telephone}
              </a>
            )}
            {parent.email && (
              <a className={styles.contactItem} href={`mailto:${parent.email}`}>
                <Mail size={13} /> {parent.email}
              </a>
            )}
            {parent.adresse && <span className={styles.contactItem}><MapPin size={13} /> {parent.adresse}</span>}
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          <GraduationCap size={16} /> Enfants liés ({enfants.length})
        </h2>

        {enfants.length === 0 ? (
          <p className={styles.emptyMsg}>Aucun élève lié à ce parent pour le moment.</p>
        ) : (
          <div className={styles.enfantsList}>
            {enfants.map((enfant) => {
              const classe = enfant.classe_actuelle_nom || enfant.classe_nom;
              return (
                <div
                  key={enfant.id}
                  className={styles.enfantRow}
                  onClick={() => navigate(`/dashboardAdmin/eleves/${enfant.id}`)}
                >
                  <div className={styles.enfantAvatar}>
                    {enfant.photo ? (
                      <img src={enfant.photo} alt="" />
                    ) : (
                      <span>{enfant.prenom?.[0]}{enfant.nom?.[0]}</span>
                    )}
                  </div>
                  <div className={styles.enfantInfo}>
                    <span className={styles.enfantName}>{enfant.prenom} {enfant.nom}</span>
                    <span className={styles.enfantMatricule}>
                      {enfant.matricule}{classe ? ` · ${classe}` : ''}
                    </span>
                  </div>
                  <div className={styles.enfantBadges}>
                    <span className={styles.lienBadge}>{TYPE_LIEN_LABEL[enfant.type_lien] || enfant.type_lien}</span>
                    {enfant.contact_principal && (
                      <span className={styles.principalBadge}>Contact principal</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FicheParent;