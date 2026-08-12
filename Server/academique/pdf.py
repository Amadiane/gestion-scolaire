from io import BytesIO
from django.db.models import Avg
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
import cloudinary.uploader

from .models import Note
from eleves.models import Inscription


def _appreciation(moyenne, bareme):
    """
    Appréciation basée sur un POURCENTAGE du barème, pas sur une valeur
    absolue — ça permet à un 16/20 et un 8/10 (même performance relative,
    80%) de recevoir la même appréciation "Excellent".
    """
    if moyenne is None or not bareme:
        return "—"
    pourcentage = (moyenne / bareme) * 100
    if pourcentage >= 80:
        return "Excellent"
    if pourcentage >= 70:
        return "Très bien"
    if pourcentage >= 60:
        return "Bien"
    if pourcentage >= 50:
        return "Passable"
    return "Insuffisant"

def generer_pdf_bulletin(bulletin):
    buffer = BytesIO()
    doc = canvas.Canvas(buffer, pagesize=A4)
    largeur, hauteur = A4

    # --- En-tête ---
    doc.setFont("Helvetica-Bold", 16)
    doc.drawCentredString(largeur / 2, hauteur - 2.5 * cm, "BULLETIN SCOLAIRE")
    doc.setFont("Helvetica", 9)
    doc.drawCentredString(largeur / 2, hauteur - 3.1 * cm, bulletin.ecole.nom)

    y = hauteur - 4.3 * cm

    # --- Identité élève ---
    doc.setFont("Helvetica-Bold", 11)
    doc.drawString(2 * cm, y, "Élève")
    y -= 0.55 * cm
    doc.setFont("Helvetica", 10)
    doc.drawString(2 * cm, y, f"Nom et prénom : {bulletin.eleve.prenom} {bulletin.eleve.nom}")
    doc.drawString(11 * cm, y, f"Matricule : {bulletin.eleve.matricule}")
    y -= 0.55 * cm
    date_naissance = bulletin.eleve.date_naissance.strftime("%d/%m/%Y") if bulletin.eleve.date_naissance else "—"
    doc.drawString(2 * cm, y, f"Né(e) le : {date_naissance}")
    doc.drawString(11 * cm, y, f"Sexe : {'Masculin' if bulletin.eleve.sexe == 'M' else 'Féminin'}")
    y -= 0.55 * cm
    doc.drawString(2 * cm, y, f"Classe : {bulletin.classe.nom}")
    doc.drawString(11 * cm, y, f"Année scolaire : {bulletin.annee_scolaire.nom}")
    y -= 0.55 * cm
    doc.drawString(2 * cm, y, f"Période : {bulletin.get_trimestre_display()}")

    # --- Tableau des notes ---
    y -= 1 * cm
    doc.setFont("Helvetica-Bold", 10)
    doc.drawString(2 * cm, y, "Matière")
    doc.drawString(7.5 * cm, y, "Note élève")
    doc.drawString(10.5 * cm, y, "Moy. classe")
    doc.drawString(13.5 * cm, y, "Coef.")
    doc.drawString(15.5 * cm, y, "Enseignant")
    y -= 0.3 * cm
    doc.line(2 * cm, y, largeur - 2 * cm, y)

    notes = Note.objects.filter(
        eleve=bulletin.eleve,
        annee_scolaire=bulletin.annee_scolaire,
        trimestre=bulletin.trimestre,
    ).select_related("matiere", "saisi_par")

    doc.setFont("Helvetica", 9)
    for note in notes:
        y -= 0.55 * cm

        # Moyenne de la classe entière pour CETTE matière — donne du
        # contexte à la note individuelle (un 8/10 n'a pas le même sens
        # selon que la classe est à 5 ou à 9 de moyenne).
        moyenne_classe = Note.objects.filter(
            classe=bulletin.classe,
            matiere=note.matiere,
            annee_scolaire=bulletin.annee_scolaire,
            trimestre=bulletin.trimestre,
        ).aggregate(m=Avg("valeur"))["m"]

        enseignant = note.saisi_par.get_full_name() if note.saisi_par else "—"

        doc.drawString(2 * cm, y, note.matiere.nom)
        doc.drawString(7.5 * cm, y, f"{note.valeur}/{note.valeur_max}")
        doc.drawString(10.5 * cm, y, f"{moyenne_classe:.2f}" if moyenne_classe is not None else "—")
        doc.drawString(13.5 * cm, y, str(note.matiere.coefficient))
        doc.drawString(15.5 * cm, y, enseignant[:22])  # tronqué pour ne pas déborder

    # --- Synthèse générale ---
    # --- Synthèse générale ---
    y -= 1.1 * cm
    doc.line(2 * cm, y, largeur - 2 * cm, y)
    y -= 0.8 * cm

    effectif_classe = Inscription.objects.filter(
        classe=bulletin.classe, annee_scolaire=bulletin.annee_scolaire
    ).count()

    bareme = bulletin.classe.niveau.bareme_note
    moyenne_affichee = f"{bulletin.moyenne_generale}/{bareme}" if bulletin.moyenne_generale is not None else "—"
    rang_affiche = f"{bulletin.rang}/{effectif_classe}" if bulletin.rang else "—"

    doc.setFont("Helvetica-Bold", 12)
    doc.drawString(2 * cm, y, f"Moyenne générale : {moyenne_affichee}")
    y -= 0.65 * cm
    doc.drawString(2 * cm, y, f"Rang : {rang_affiche}")
    y -= 0.65 * cm
    doc.setFont("Helvetica-Bold", 11)
    doc.drawString(2 * cm, y, f"Appréciation : {_appreciation(bulletin.moyenne_generale, bareme)}")

    # --- Pied de page : date d'édition + signature ---
    y_bas = 3.5 * cm
    doc.setFont("Helvetica", 8)
    date_edition = bulletin.date_generation.strftime("%d/%m/%Y") if bulletin.date_generation else "—"
    doc.drawString(2 * cm, y_bas, f"Édité le {date_edition}")

    doc.line(largeur - 8 * cm, y_bas + 1.3 * cm, largeur - 2 * cm, y_bas + 1.3 * cm)
    doc.setFont("Helvetica", 9)
    if bulletin.statut == bulletin.Statut.VALIDE or bulletin.statut == bulletin.Statut.PUBLIE:
        nom_valideur = bulletin.valide_par.get_full_name() if bulletin.valide_par else "Direction"
        doc.drawCentredString(largeur - 5 * cm, y_bas + 0.7 * cm, f"Signé électroniquement par {nom_valideur}")
    else:
        doc.drawCentredString(largeur - 5 * cm, y_bas + 0.7 * cm, "Signature du Directeur")

    doc.showPage()
    doc.save()
    buffer.seek(0)

    resultat = cloudinary.uploader.upload(
        buffer,
        resource_type="raw",
        type="authenticated",
        public_id=f"bulletins/bulletin_{bulletin.eleve.matricule}_{bulletin.annee_scolaire.nom}_{bulletin.trimestre}.pdf",
        overwrite=True,
    )
    return resultat["public_id"], resultat["version"]