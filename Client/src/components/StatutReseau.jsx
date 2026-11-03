import { useEffect, useState } from 'react'
import useOnlineStatus from '../hooks/useOnlineStatus'
import styles from '../theme/components/StatutReseau.module.css'

export default function StatutReseau() {
  const enLigne = useOnlineStatus()
  const [retour, setRetour] = useState(false)
  const [etaitHorsLigne, setEtaitHorsLigne] = useState(false)

  useEffect(() => {
    if (!enLigne) {
      setEtaitHorsLigne(true)
      setRetour(false)
    } else if (etaitHorsLigne) {
      setRetour(true)
      const t = setTimeout(() => { setRetour(false); setEtaitHorsLigne(false) }, 3000)
      return () => clearTimeout(t)
    }
  }, [enLigne, etaitHorsLigne])

  if (enLigne && !retour) return null
  return (
    <div className={`${styles.bandeau} ${enLigne ? styles.ok : styles.off}`} role="status">
      {enLigne ? 'Connexion rétablie' : 'Vous êtes hors ligne. Certaines fonctions sont limitées.'}
    </div>
  )
}