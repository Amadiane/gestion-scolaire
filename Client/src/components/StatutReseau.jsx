import { useEffect, useState } from 'react'
import useOnlineStatus from '../hooks/useOnlineStatus'
import styles from '../theme/components/StatutReseau.module.css'

const formater = (ts) =>
  new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function StatutReseau() {
  const enLigne = useOnlineStatus()
  const [local, setLocal] = useState(null)
  const [retour, setRetour] = useState(false)
  const [etaitHorsLigne, setEtaitHorsLigne] = useState(false)

  useEffect(() => {
    const surDonneesLocales = (e) => setLocal(e.detail.le)
    window.addEventListener('sylium:donnees-locales', surDonneesLocales)
    return () => window.removeEventListener('sylium:donnees-locales', surDonneesLocales)
  }, [])

  useEffect(() => {
    if (!enLigne) {
      setEtaitHorsLigne(true)
      setRetour(false)
    } else if (etaitHorsLigne) {
      setLocal(null)
      setRetour(true)
      const t = setTimeout(() => { setRetour(false); setEtaitHorsLigne(false) }, 3000)
      return () => clearTimeout(t)
    }
  }, [enLigne, etaitHorsLigne])

  if (enLigne && !retour && !local) return null

  let texte
  let classe = styles.off
  if (enLigne && retour) { texte = 'Connexion rétablie'; classe = styles.ok }
  else if (local) texte = `${enLigne ? 'Serveur injoignable' : 'Hors ligne'} · données du ${formater(local)}`
  else texte = 'Vous êtes hors ligne. Certaines fonctions sont limitées.'

  return <div className={`${styles.bandeau} ${classe}`} role="status">{texte}</div>
}