// Contenu du guide intégré d'Ecolia.
// roles : "tous" ou une liste parmi directeur, secretaire, comptable, surveillant, enseignant.
// Le directeur voit toutes les rubriques.

// Renseignez ici le contact d'aide (laissez vide pour masquer la carte).
export const SUPPORT = {
  nom: '',
  telephone: '',
  whatsapp: '', // ex. 224620000000 (indicatif sans le +)
};

export const ROLES_LIBELLES = {
  directeur: 'Directeur',
  secretaire: 'Secrétaire',
  comptable: 'Comptable',
  surveillant: 'Surveillant',
  enseignant: 'Enseignant',
};

export const SECTIONS = [
  {
    id: 'demarrer',
    titre: 'Se connecter et protéger son compte',
    roles: ['tous'],
    resume: "Chaque personne a son compte. Ne le prêtez jamais : ce que vous faites y est enregistré.",
    etapes: [
      "Ouvrez Ecolia dans votre navigateur, ou depuis l'icône installée sur votre téléphone.",
      "Saisissez votre identifiant et votre mot de passe.",
      "Changez votre mot de passe à la première connexion avec le bouton « Mon mot de passe », en bas du menu.",
      "En fin de travail sur un ordinateur partagé, cliquez sur « Déconnexion ».",
    ],
    astuces: ["Sur téléphone, ajoutez Ecolia à l'écran d'accueil : elle s'ouvre comme une application."],
  },
  {
    id: 'annees',
    titre: 'Années scolaires',
    roles: ['directeur'],
    resume: "Une année scolaire regroupe les classes, les notes et les paiements d'une période.",
    etapes: [
      "Menu Administration, puis « Années scolaires ».",
      "Créez l'année (par exemple 2026-2027) avec ses dates de début et de fin.",
      "Activez l'année en cours : seules les classes de l'année active s'affichent par défaut.",
    ],
    astuces: [
      "On ne peut pas supprimer l'année active ni une année qui contient des classes.",
      "Créez la nouvelle année avant de recréer les classes de la rentrée.",
    ],
  },
  {
    id: 'classes',
    titre: 'Classes : créer, modifier, supprimer',
    roles: ['directeur', 'secretaire'],
    resume: "Les classes sont créées par la direction ou le secrétariat, par année scolaire.",
    etapes: [
      "Menu « Classes », puis « Nouvelle classe ».",
      "Indiquez le nom, le niveau, l'année et l'effectif maximum.",
      "Pour créer plusieurs sections d'un coup (A, B, C…), choisissez le nombre de sections : le nom saisi sert de base.",
      "Pour modifier, cliquez sur le crayon de la classe : nom, niveau, effectif maximum et matières enseignées.",
      "Pour supprimer, cliquez sur la corbeille : l'écran indique ce que la classe contient.",
    ],
    astuces: [
      "Le niveau ne peut plus changer quand des notes existent : le barème (sur 10 ou sur 20) en dépend.",
      "Une classe qui contient des élèves, des notes, des bulletins ou des présences ne peut pas être supprimée.",
      "Le nom d'une classe doit être unique dans l'année.",
    ],
  },
  {
    id: 'eleves',
    titre: 'Élèves et inscriptions',
    roles: ['directeur', 'secretaire'],
    resume: "Chaque élève a une fiche avec sa photo, son matricule et sa classe.",
    etapes: [
      "Menu « Élèves », puis le bouton d'ajout.",
      "Renseignez l'identité, la classe et, si possible, la photo.",
      "Le matricule est créé automatiquement.",
      "Ouvrez une fiche pour modifier les informations ou voir les parents liés.",
    ],
    astuces: [
      "Utilisez la recherche et le tri pour retrouver un élève rapidement.",
      "Sans connexion, la saisie est conservée puis envoyée au retour du réseau.",
    ],
  },
  {
    id: 'parents',
    titre: 'Parents et contacts',
    roles: ['directeur', 'secretaire'],
    resume: "Un élève peut avoir plusieurs parents ou tuteurs, avec deux numéros chacun.",
    etapes: [
      "Ouvrez la fiche de l'élève, rubrique des contacts.",
      "Ajoutez un parent existant ou créez-en un nouveau, avec son lien (père, mère, tuteur…).",
      "Saisissez le numéro principal et, si possible, un deuxième numéro.",
      "Choisissez le contact principal : c'est lui qui est proposé en premier pour les alertes.",
    ],
    astuces: [
      "Plus il y a de contacts, plus on a de chances de joindre quelqu'un : ajoutez-en autant que nécessaire.",
      "Écrivez les numéros sans espace, avec ou sans l'indicatif : l'application s'adapte.",
      "Les enseignants ne voient pas les coordonnées des parents.",
    ],
  },
  {
    id: 'affectations',
    titre: 'Affecter les enseignants',
    roles: ['directeur'],
    resume: "Un enseignant ne voit et ne note que les classes et matières qui lui sont affectées.",
    etapes: [
      "Créez d'abord le compte de l'enseignant dans « Utilisateurs » (rôle Enseignant).",
      "Menu « Affectations », puis ajoutez : enseignant, classe, matière.",
      "Répétez pour chaque classe et chaque matière enseignée.",
    ],
    astuces: ["Sans affectation, l'enseignant ne peut ni faire l'appel ni saisir de notes."],
  },
  {
    id: 'appel',
    titre: "Faire l'appel",
    roles: ['directeur', 'surveillant', 'enseignant', 'secretaire'],
    resume: "L'appel enregistre pour chaque élève : présent, absent ou en retard.",
    etapes: [
      "Menu « Faire l'appel ».",
      "Choisissez la classe et la date.",
      "Marquez chaque élève : présent, absent ou en retard. Ajoutez une remarque si utile.",
      "Enregistrez. Les absences et retards alimentent la liste des alertes aux parents.",
    ],
    astuces: ["Les statistiques de présence s'affichent dans le tableau de bord, par jour, semaine, mois ou année."],
  },
  {
    id: 'alertes',
    titre: 'Alertes aux parents (absences et retards)',
    roles: ['directeur', 'secretaire', 'surveillant'],
    resume: "Prévenez les parents le jour même, par WhatsApp, en un clic.",
    etapes: [
      "Menu « Alertes parents ». La liste du jour montre les élèves absents ou en retard.",
      "Cliquez sur le bouton WhatsApp d'un parent : le message est prêt, il vous reste à l'envoyer.",
      "Si un parent ne répond pas, utilisez un autre contact de l'élève.",
      "Marquez l'élève comme « prévenu » pour que toute l'équipe le sache.",
    ],
    astuces: [
      "Vous pouvez modifier le texte du message : il est conservé pour les prochaines alertes.",
      "L'envoi se fait depuis votre WhatsApp : vérifiez le message avant d'envoyer.",
    ],
  },
  {
    id: 'notes',
    titre: 'Saisir les notes',
    roles: ['enseignant', 'directeur'],
    resume: "Les notes se saisissent par trimestre, matière et classe, avec contrôle du barème.",
    etapes: [
      "Menu « Saisir des notes ».",
      "Choisissez la classe, la matière et le trimestre.",
      "Saisissez la note de chaque élève, dans la limite du barème de la classe.",
      "Les notes sont enregistrées au fur et à mesure.",
    ],
    astuces: [
      "Hors connexion, la saisie reste possible : elle est envoyée automatiquement au retour du réseau.",
      "Vous ne pouvez noter que les matières et classes qui vous sont affectées.",
    ],
  },
  {
    id: 'bulletins',
    titre: 'Bulletins',
    roles: ['directeur'],
    resume: "Le bulletin est calculé à partir des notes, puis validé par la direction.",
    etapes: [
      "Vérifiez que toutes les notes du trimestre sont saisies.",
      "Ouvrez les bulletins de la classe : moyennes pondérées et rangs sont calculés.",
      "Validez les bulletins.",
      "Téléchargez le PDF d'un bulletin pour l'imprimer ou l'envoyer.",
    ],
    astuces: ["Les moyennes tiennent compte des coefficients des matières."],
  },
  {
    id: 'finance',
    titre: 'Finances et situation des élèves',
    roles: ['directeur', 'comptable'],
    resume: "Suivez ce que chaque élève doit, a payé et reste à payer.",
    etapes: [
      "Menu « Finance ».",
      "Définissez les frais par niveau.",
      "Enregistrez chaque paiement reçu, avec le montant et la date.",
      "Consultez la situation d'un élève : montant à payer, payé, reste.",
    ],
    astuces: [
      "Seuls la direction et la comptabilité accèdent aux finances.",
      "Le tableau de bord affiche l'encaissé du mois et le reste à recouvrer.",
    ],
  },
  {
    id: 'relances',
    titre: 'Relances de paiement',
    roles: ['directeur', 'comptable'],
    resume: "Relancez par WhatsApp les parents dont le reste à payer est positif.",
    etapes: [
      "Menu « Relances paiement ». La liste montre les élèves qui ont un reste à payer.",
      "Cliquez sur le bouton WhatsApp du parent : le message est prêt avec le montant.",
      "Envoyez-le, puis marquez la relance comme faite.",
      "En l'absence de réponse, essayez un autre contact de l'élève.",
    ],
    astuces: ["Seuls les parents qui doivent encore de l'argent figurent dans la liste."],
  },
  {
    id: 'emplois',
    titre: 'Emplois du temps',
    roles: ['directeur', 'secretaire', 'enseignant'],
    resume: "Chaque école compose ses créneaux librement, classe par classe.",
    etapes: [
      "Direction et secrétariat : menu « Emplois du temps », choisissez la classe, puis ajoutez les créneaux.",
      "Chaque créneau : jour, heure de début et de fin, matière ou libellé libre, enseignant, salle.",
      "Enseignant : menu « Mon emploi du temps », pour planifier vos propres cours.",
      "Utilisez « Imprimer » ou « Télécharger » pour obtenir un PDF ou un tableur.",
    ],
    astuces: [
      "L'application refuse les conflits : classe, enseignant ou salle déjà occupés.",
      "Dupliquez un créneau pour gagner du temps.",
      "Un enseignant ne modifie que ses propres créneaux.",
    ],
  },
  {
    id: 'personnel',
    titre: 'Personnel et utilisateurs',
    roles: ['directeur'],
    resume: "Créez les comptes de votre équipe et donnez à chacun le bon rôle.",
    etapes: [
      "Menu « Utilisateurs », puis création d'un compte : nom, identifiant, rôle.",
      "Remettez le mot de passe temporaire à la personne et demandez-lui de le changer.",
      "Le menu « Personnel » regroupe les fiches de l'équipe.",
    ],
    astuces: ["Donnez le rôle minimal nécessaire : un comptable n'a pas besoin des notes, un enseignant pas des finances."],
  },
  {
    id: 'ecole',
    titre: 'Mon école',
    roles: ['directeur'],
    resume: "Les informations de l'établissement.",
    etapes: ["Menu « Mon école » : consultez et tenez à jour l'identité de l'école."],
    astuces: [],
  },
  {
    id: 'horsligne',
    titre: 'Quand la connexion est mauvaise',
    roles: ['tous'],
    resume: "Ecolia fonctionne en mode hybride : en ligne et, pour l'essentiel, hors ligne.",
    etapes: [
      "Continuez à saisir normalement : les notes saisies sans réseau sont gardées sur votre appareil.",
      "Au retour d'internet, elles sont envoyées automatiquement.",
      "Si un message d'erreur « connexion internet requise » apparaît, attendez le réseau puis réessayez.",
    ],
    astuces: ["Ne vous déconnectez pas et ne videz pas les données du navigateur avant que l'envoi soit fait."],
  },
];