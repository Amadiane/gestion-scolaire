from io import BytesIO

from django.db.models import Sum
from reportlab.lib.pagesizes import A5
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

from .models import Paiement
from .services import calculer_situations


def _gnf(valeur):
    return f"{int(valeur):,}".replace(",", " ") + " GNF"


def generer_recu_pdf(paiement):
    eleve = paiement.eleve
    situations = calculer_situations(paiement.ecole, paiement.annee_scolaire, eleve_id=eleve.id)
    sit = situations[0] if situations else None

    # Situation arrêtée à CE paiement : le reçu reste identique même si
    # d'autres paiements sont enregistrés plus tard.
    paye_a_date = (
        Paiement.objects.filter(
            eleve=eleve, annee_scolaire=paiement.annee_scolaire, id__lte=paiement.id
        ).aggregate(t=Sum("montant"))["t"] or 0
    )

    buffer = BytesIO()
    doc = canvas.Canvas(buffer, pagesize=A5)
    largeur, hauteur = A5

    doc.setFont("Helvetica-Bold", 15)
    doc.drawCentredString(largeur / 2, hauteur - 1.8 * cm, "REÇU DE PAIEMENT")
    doc.setFont("Helvetica", 10)
    doc.drawCentredString(largeur / 2, hauteur - 2.5 * cm, paiement.ecole.nom)

    y = hauteur - 3.8 * cm
    doc.setFont("Helvetica-Bold", 10)
    doc.drawString(1.5 * cm, y, f"N° {paiement.numero_recu}")
    doc.setFont("Helvetica", 10)
    doc.drawRightString(largeur - 1.5 * cm, y, f"Date : {paiement.date_paiement.strftime('%d/%m/%Y')}")

    y -= 1 * cm
    lignes = [
        ("Élève", f"{eleve.prenom} {eleve.nom}"),
        ("Matricule", eleve.matricule),
        ("Classe", sit["classe_nom"] if sit else "—"),
        ("Année scolaire", paiement.annee_scolaire.nom),
        ("Mode de paiement", paiement.get_mode_display()),
    ]
    if paiement.reference:
        lignes.append(("Référence", paiement.reference))
    for etiquette, valeur in lignes:
        doc.setFont("Helvetica", 9)
        doc.drawString(1.5 * cm, y, f"{etiquette} :")
        doc.setFont("Helvetica-Bold", 10)
        doc.drawString(5 * cm, y, str(valeur))
        y -= 0.6 * cm

    y -= 0.4 * cm
    doc.rect(1.5 * cm, y - 0.9 * cm, largeur - 3 * cm, 1.4 * cm)
    doc.setFont("Helvetica-Bold", 13)
    doc.drawCentredString(largeur / 2, y - 0.3 * cm, f"Montant reçu : {_gnf(paiement.montant)}")

    if sit:
        y -= 2 * cm
        a_payer = sit["a_payer"]
        reste = max(a_payer - int(paye_a_date), 0)
        doc.setFont("Helvetica", 9)
        doc.drawString(1.5 * cm, y, f"Total à payer (remise déduite) : {_gnf(a_payer)}")
        y -= 0.5 * cm
        doc.drawString(1.5 * cm, y, f"Total payé à ce jour : {_gnf(paye_a_date)}")
        y -= 0.5 * cm
        doc.setFont("Helvetica-Bold", 10)
        doc.drawString(1.5 * cm, y, f"Reste à payer : {_gnf(reste)}")

    doc.setFont("Helvetica", 9)
    doc.drawString(1.5 * cm, 2.6 * cm, "Le comptable")
    doc.line(1.5 * cm, 2.2 * cm, 6 * cm, 2.2 * cm)
    doc.setFont("Helvetica-Oblique", 7)
    doc.drawCentredString(largeur / 2, 1.2 * cm, "Document généré par Sylium Intelligence Système")

    doc.showPage()
    doc.save()
    return buffer.getvalue()