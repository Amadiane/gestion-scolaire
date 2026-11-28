// Modules annoncés dans le menu, pour la présentation aux écoles.
// Pour les masquer : AFFICHER_MODULES_A_VENIR = false. Pour en retirer un, quand il est livré :
// supprimez sa ligne ici et ajoutez son vrai lien dans Sidebar.jsx.
import { Smartphone, Banknote, Receipt, ClipboardList, Sparkles, MessageSquare, Download } from 'lucide-react';

export const AFFICHER_MODULES_A_VENIR = true;

// Les statuts reprennent exactement ceux du cahier des charges remis aux écoles.
const EN_COURS = 'En cours de développement';
const PREVU = 'Prévu';

export const MODULES_A_VENIR = [
  {
    id: 'parents', label: 'Espace parents', icon: Smartphone, statut: EN_COURS,
    description: "Chaque parent suit ses enfants depuis son téléphone : notes, bulletins, absences, frais et emploi du temps.",
  },
  {
    id: 'recus', label: 'Reçus numériques', icon: Receipt, statut: EN_COURS,
    description: "Un reçu numéroté pour chaque paiement, envoyé au parent par WhatsApp.",
  },
  {
    id: 'paiement', label: 'Paiement en ligne', icon: Banknote, statut: PREVU,
    description: "Les parents règlent les frais de scolarité depuis leur téléphone, par mobile money ou carte.",
  },
  {
    id: 'exercices', label: 'Exercices et devoirs', icon: ClipboardList, statut: PREVU,
    description: "Les enseignants publient des exercices et des devoirs ; les élèves et les parents les retrouvent dans l'application.",
  },
  {
    id: 'ia', label: 'Assistant intelligent', icon: Sparkles, statut: PREVU,
    description: "Des assistants qui répondent aux parents et à la direction, et aident les enseignants. Réservé à la formule abonnement.",
  },
  {
    id: 'sms', label: 'Notifications SMS', icon: MessageSquare, statut: PREVU,
    description: "Alertes par SMS, envoyées uniquement sur demande des parents. Service proposé en supplément.",
  },
  {
    id: 'export', label: 'Export des données', icon: Download, statut: PREVU,
    description: "Récupérez à tout moment l'ensemble des données de votre école dans un fichier.",
  },
];