import { useRegisterSW } from 'virtual:pwa-register/react'
import styles from '../theme/components/MiseAJour.module.css'

export default function MiseAJour() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div className={styles.carte} role="alert">
      <span>Une nouvelle version est disponible.</span>
      <button onClick={() => updateServiceWorker(true)}>Mettre à jour</button>
      <button className={styles.plus} onClick={() => setNeedRefresh(false)}>Plus tard</button>
    </div>
  )
}