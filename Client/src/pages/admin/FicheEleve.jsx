import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Download } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import SituationFinanciere from './SituationFinanciere.jsx';
import AssiduiteEleve from '../../components/Presences/AssiduiteEleve.jsx';
import ContactsParents from '../../components/Contacts/ContactsParents.jsx';
import styles from '../../theme/pages/admin/FicheEleve.module.css';

const TRIMESTRE_LABEL = { t1: '1er trimestre', t2: '2ème trimestre', t3: '3ème trimestre' };
const RANG_TRIMESTRE = { t1: 1, t2: 2, t3: 3 };

const STATUT_LABEL = {
  actif: 'Actif',
  suspendu: 'Suspendu',
  exclu: 'Exclu',
  transfere: 'Transféré',
  diplome: 'Diplômé',
  attente: 'En attente',
};

const fmtDate = (v) => {
  const [a, m, j] = String(v || '').slice(0, 10).split('-');
  return j ? `${j}/${m}/${a}` : '—';
};

const FicheEleve = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [eleve, setEleve] = useState(null);
  const [bulletins, setBulletins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [genererPdfId, setGenererPdfId] = useState(null);

  useEffect(() => {
    const charger = async () => {
      setLoading(true);
      setError('');
      try {
        const [resEleve, resBulletins] = await Promise.all([
          api.get(CONFIG.API_ELEVE_DETAIL(id)),
          api.get(CONFIG.API_BULLETINS),
        ]);
        setEleve(resEleve.data);
        // Le backend limite déjà à l'école ; on isole ici l'élève.
        setBulletins(resBulletins.data.filter((b) => b.eleve === Number(id)));
      } catch (err) {
        setError(
          err.response?.status === 404
            ? "Cet élève n'existe pas ou n'appartient pas à votre école."
            : "Impossible de charger la fiche de cet élève."
        );
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, [id]);

  const handleTelechargerPdf = async (bulletin) => {
    setGenererPdfId(bulletin.id);
    try {
      // telecharger_pdf génère le PDF puis renvoie une URL de téléchargement.
      const resUrl = await api.get(CONFIG.API_BULLETIN_TELECHARGER(bulletin.id));
      const response = await fetch(resUrl.data.url);

      if (!response.ok) {
        throw new Error(`Téléchargement refusé (${response.status})`);
      }

      const blob = await response.blob();
      if (blob.size < 100) {
        throw new Error('Le fichier reçu ne semble pas être un PDF valide.');
      }

      const nomEleve = `${eleve.prenom}_${eleve.nom}`.replace(/\s+/g, '_');
      const nomTrimestre = bulletin.trimestre.toUpperCase();

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `bulletin_${nomEleve}_${nomTrimestre}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert(err.message || 'Impossible de télécharger ce bulletin.');
    } finally {
      setGenererPdfId(null);
    }
  };

  if (loading) return <div className={styles.wrapper}><p className={styles.stateMsg}>Chargement...</p></div>;
  if (error) {
    return (
      <div className={styles.wrapper}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Retour
        </button>
        <p className={styles.errorMsg}>{error}</p>
      </div>
    );
  }
  if (!eleve) return null;

  // Année la plus récente d'abord, puis 1er → 3ème trimestre.
  const bulletinsTries = [...bulletins].sort(
    (a, b) =>
      (b.annee_scolaire ?? 0) - (a.annee_scolaire ?? 0) ||
      (RANG_TRIMESTRE[a.trimestre] || 9) - (RANG_TRIMESTRE[b.trimestre] || 9)
  );

  return (
    <div className={styles.wrapper}>
      <button className={styles.backButton} onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Retour à la liste
      </button>

      <div className={styles.headerCard}>
        <div className={styles.photoBox}>
          {eleve.photo ? (
            <img src={eleve.photo} alt={`${eleve.prenom} ${eleve.nom}`} className={styles.photo} />
          ) : (
            <div className={styles.photoPlaceholder}>
              {eleve.prenom?.[0]}{eleve.nom?.[0]}
            </div>
          )}
        </div>
        <div className={styles.headerInfo}>
          <h1 className={styles.name}>{eleve.prenom} {eleve.nom}</h1>
          <p className={styles.matricule}>Matricule : {eleve.matricule}</p>
          <div className={styles.metaRow}>
            <span className={`${styles.badge} ${styles['badge_' + eleve.statut]}`}>
              {STATUT_LABEL[eleve.statut] || eleve.statut}
            </span>
            {eleve.classe_actuelle_nom
              ? <span className={styles.classeTag}>{eleve.classe_actuelle_nom}</span>
              : <span className={styles.classeTag}>Sans classe</span>}
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Informations personnelles</h2>
          <dl className={styles.infoList}>
            <div><dt>Date de naissance</dt><dd>{fmtDate(eleve.date_naissance)}</dd></div>
            <div><dt>Lieu de naissance</dt><dd>{eleve.lieu_naissance || '—'}</dd></div>
            <div><dt>Sexe</dt><dd>{eleve.sexe === 'M' ? 'Masculin' : eleve.sexe === 'F' ? 'Féminin' : '—'}</dd></div>
            <div><dt>Date d'inscription</dt><dd>{fmtDate(eleve.date_inscription)}</dd></div>
          </dl>
        </div>

        {/* Plusieurs parents possibles ; masquée d'elle-même pour les enseignants. */}
        <div className={styles.card}>
          <ContactsParents eleveId={id} />
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            <FileText size={16} /> Bulletins ({bulletinsTries.length})
          </h2>
          {bulletinsTries.length === 0 ? (
            <p className={styles.emptyMsg}>Aucun bulletin pour le moment.</p>
          ) : (
            <ul className={styles.bulletinList}>
              {bulletinsTries.map((b) => (
                <li key={b.id} className={styles.bulletinItem}>
                  <div>
                    <span className={styles.bulletinTrimestre}>
                      {TRIMESTRE_LABEL[b.trimestre] || b.trimestre}
                      {b.statut === 'brouillon' && ' · Brouillon'}
                    </span>
                    <span className={styles.bulletinMoyenne}>
                      {b.moyenne_generale != null ? `Moyenne : ${b.moyenne_generale}` : 'Pas encore calculée'}
                      {b.rang && ` · Rang : ${b.rang}`}
                    </span>
                  </div>
                  <button
                    className={styles.downloadButton}
                    onClick={() => handleTelechargerPdf(b)}
                    disabled={genererPdfId === b.id}
                  >
                    <Download size={14} />
                    {genererPdfId === b.id ? 'Génération...' : 'PDF'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <SituationFinanciere eleveId={id} />

        {/* Masquée d'elle-même si l'assiduité n'est pas accessible (comptable, hors ligne). */}
        <div className={styles.card}>
          <AssiduiteEleve eleveId={id} />
        </div>
      </div>
    </div>
  );
};

export default FicheEleve;