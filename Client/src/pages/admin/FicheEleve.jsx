import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, Users, FileText, Download } from 'lucide-react';
import api from '../../services/api.js';
import CONFIG from '../../config/config.js';
import styles from '../../theme/pages/admin/FicheEleve.module.css';

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
      try {
        const [resEleve, resBulletins] = await Promise.all([
          api.get(CONFIG.API_ELEVE_DETAIL(id)),
          api.get(CONFIG.API_BULLETINS),
        ]);
        setEleve(resEleve.data);
        // Filtre côté client : les bulletins de CET élève seulement.
        // TenantScopedQuerysetMixin a déjà limité à l'école, il reste
        // juste à isoler l'élève précis parmi ceux de l'école.
        setBulletins(resBulletins.data.filter((b) => b.eleve === Number(id)));
      } catch {
        setError("Impossible de charger la fiche de cet élève.");
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, [id]);

  const handleTelechargerPdf = async (bulletin) => {
  setGenererPdfId(bulletin.id);
  try {
    // telecharger_pdf gère la génération automatiquement si besoin —
    // plus besoin d'appeler generer_pdf séparément avant.
    const resUrl = await api.get(CONFIG.API_BULLETIN_TELECHARGER(bulletin.id));
    const response = await fetch(resUrl.data.url);

    if (!response.ok) {
      const texteErreur = await response.text();
      console.error('Réponse Cloudinary non valide :', response.status, texteErreur);
      throw new Error(`Cloudinary a refusé la requête (${response.status})`);
    }

    const blob = await response.blob();
    if (blob.size < 100) {
      const texte = await blob.text();
      console.error('Fichier suspect (trop petit) :', texte);
      throw new Error('Le fichier reçu ne semble pas être un PDF valide.');
    }

    const nomEleve = `${eleve.prenom}_${eleve.nom}`.replace(/\s+/g, '_');
    const nomTrimestre = bulletin.trimestre === 't1' ? 'T1' : bulletin.trimestre === 't2' ? 'T2' : 'T3';

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `bulletin_${nomEleve}_${nomTrimestre}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (err) {
    alert(err.message || "Impossible de télécharger ce bulletin.");
  } finally {
    setGenererPdfId(null);
  }
};

  if (loading) return <div className={styles.wrapper}><p className={styles.stateMsg}>Chargement...</p></div>;
  if (error) return <div className={styles.wrapper}><p className={styles.errorMsg}>{error}</p></div>;
  if (!eleve) return null;

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
            <span className={`${styles.badge} ${styles['badge_' + eleve.statut]}`}>{eleve.statut}</span>
            {eleve.classe_actuelle_nom && <span className={styles.classeTag}>{eleve.classe_actuelle_nom}</span>}
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Informations personnelles</h2>
          <dl className={styles.infoList}>
            <div><dt>Date de naissance</dt><dd>{eleve.date_naissance || '—'}</dd></div>
            <div><dt>Lieu de naissance</dt><dd>{eleve.lieu_naissance || '—'}</dd></div>
            <div><dt>Sexe</dt><dd>{eleve.sexe === 'M' ? 'Masculin' : 'Féminin'}</dd></div>
            <div><dt>Date d'inscription</dt><dd>{eleve.date_inscription || '—'}</dd></div>
          </dl>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            <FileText size={16} /> Bulletins
          </h2>
          {bulletins.length === 0 ? (
            <p className={styles.emptyMsg}>Aucun bulletin pour le moment.</p>
          ) : (
            <ul className={styles.bulletinList}>
              {bulletins.map((b) => (
                <li key={b.id} className={styles.bulletinItem}>
                  <div>
                    <span className={styles.bulletinTrimestre}>
                      {b.trimestre === 't1' ? '1er trimestre' : b.trimestre === 't2' ? '2ème trimestre' : '3ème trimestre'}
                    </span>
                    <span className={styles.bulletinMoyenne}>
                      {b.moyenne_generale != null ? `Moyenne : ${b.moyenne_generale}/20` : 'Pas encore calculée'}
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
      </div>
    </div>
  );
};

export default FicheEleve;