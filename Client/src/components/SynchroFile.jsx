import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { compterFile, listerProblemes, abandonner, synchroniser } from '../offline/file.js'
import styles from '../theme/components/SynchroFile.module.css'

export default function SynchroFile() {
  const [etat, setEtat] = useState({ attente: 0, problemes: 0 })
  const [problemes, setProblemes] = useState([])
  const [ouvert, setOuvert] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [bilan, setBilan] = useState(null)

  const rafraichir = useCallback(async () => {
    setEtat(await compterFile())
    setProblemes(await listerProblemes())
  }, [])

  const lancer = useCallback(async () => {
    setEnCours(true)
    const r = await synchroniser()
    setEnCours(false)
    if (r.ok && r.envoyees > 0) {
      setBilan(r)
      setTimeout(() => setBilan(null), 6000)
    }
    rafraichir()
  }, [rafraichir])

  useEffect(() => {
    rafraichir()
    lancer()
    const surChangement = () => rafraichir()
    const surReseau = () => lancer()
    window.addEventListener('sylium:file-changee', surChangement)
    window.addEventListener('sylium:cle-prete', surReseau)
    window.addEventListener('online', surReseau)
    const minuteur = setInterval(() => { if (navigator.onLine) lancer() }, 60000)
    return () => {
      window.removeEventListener('sylium:file-changee', surChangement)
      window.removeEventListener('sylium:cle-prete', surReseau)
      window.removeEventListener('online', surReseau)
      clearInterval(minuteur)
    }
  }, [lancer, rafraichir])

  const total = etat.attente + etat.problemes
  if (total === 0 && !bilan) return null

  return (
    <div className={styles.zone}>
      {bilan && (
        <div className={`${styles.pastille} ${styles.ok}`} role="status">
          <CheckCircle2 size={15} /> {bilan.envoyees} opération(s) envoyée(s)
          {bilan.ecrasees.length > 0 && ` · ${bilan.ecrasees.length} note(s) remplacée(s)`}
        </div>
      )}

      {total > 0 && (
        <button
          className={`${styles.pastille} ${etat.problemes ? styles.alerte : styles.attente}`}
          onClick={() => setOuvert((o) => !o)}
        >
          {etat.problemes ? <AlertTriangle size={15} /> : <RefreshCw size={15} className={enCours ? styles.tourne : ''} />}
          {etat.attente > 0 && `${etat.attente} en attente`}
          {etat.attente > 0 && etat.problemes > 0 && ' · '}
          {etat.problemes > 0 && `${etat.problemes} à vérifier`}
        </button>
      )}

      {ouvert && total > 0 && (
        <div className={styles.panneau}>
          <div className={styles.entete}>
            <strong>Synchronisation</strong>
            <button className={styles.fermer} onClick={() => setOuvert(false)} aria-label="Fermer"><X size={16} /></button>
          </div>
          <p className={styles.texte}>
            {etat.attente > 0
              ? `${etat.attente} opération(s) seront envoyées dès que le réseau le permet.`
              : 'Tout est envoyé, sauf les éléments ci-dessous.'}
          </p>
          {problemes.map((p) => (
            <div key={p.id} className={styles.probleme}>
              <span>{p.detail || 'Erreur inconnue'}</span>
              <button onClick={() => abandonner(p.id)}>Abandonner</button>
            </div>
          ))}
          <button className={styles.bouton} onClick={lancer} disabled={enCours || !navigator.onLine}>
            {enCours ? 'Envoi en cours...' : navigator.onLine ? 'Synchroniser maintenant' : 'Hors ligne'}
          </button>
        </div>
      )}
    </div>
  )
}