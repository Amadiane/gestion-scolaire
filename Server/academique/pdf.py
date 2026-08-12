from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
import cloudinary.uploader


def generer_pdf_bulletin(bulletin):
    buffer = BytesIO()
    doc = canvas.Canvas(buffer, pagesize=A4)
    largeur, hauteur = A4

    doc.setFont("Helvetica-Bold", 16)
    doc.drawCentredString(largeur / 2, hauteur - 3 * cm, "BULLETIN SCOLAIRE")

    doc.setFont("Helvetica", 11)
    y = hauteur - 5 * cm
    doc.drawString(2 * cm, y, f"École : {bulletin.ecole.nom}")
    y -= 0.6 * cm
    doc.drawString(2 * cm, y, f"Élève : {bulletin.eleve.prenom} {bulletin.eleve.nom}")
    y -= 0.6 * cm
    doc.drawString(2 * cm, y, f"Classe : {bulletin.classe.nom}")
    y -= 0.6 * cm
    doc.drawString(2 * cm, y, f"Année scolaire : {bulletin.annee_scolaire.nom}")
    y -= 0.6 * cm
    doc.drawString(2 * cm, y, f"Période : {bulletin.get_trimestre_display()}")

    y -= 1.2 * cm
    doc.setFont("Helvetica-Bold", 11)
    doc.drawString(2 * cm, y, "Matière")
    doc.drawString(10 * cm, y, "Note")
    doc.drawString(14 * cm, y, "Coefficient")
    y -= 0.4 * cm
    doc.line(2 * cm, y, largeur - 2 * cm, y)

    doc.setFont("Helvetica", 10)
    notes = bulletin.eleve.notes.filter(
        annee_scolaire=bulletin.annee_scolaire, trimestre=bulletin.trimestre
    )
    for note in notes:
        y -= 0.6 * cm
        doc.drawString(2 * cm, y, note.matiere.nom)
        doc.drawString(10 * cm, y, f"{note.valeur}/{note.valeur_max}")
        doc.drawString(14 * cm, y, str(note.matiere.coefficient))

    y -= 1.2 * cm
    doc.setFont("Helvetica-Bold", 12)
    moyenne_affichee = bulletin.moyenne_generale if bulletin.moyenne_generale is not None else "—"
    doc.drawString(2 * cm, y, f"Moyenne générale : {moyenne_affichee}/20")

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
    # On a besoin des deux : le public_id ET la version exacte,
    # indispensable pour signer correctement l'URL de téléchargement.
    return resultat["public_id"], resultat["version"]

    # On stocke le public_id, pas l'URL directe — l'URL signée sera
    # régénérée à chaque téléchargement, avec une expiration courte.
  