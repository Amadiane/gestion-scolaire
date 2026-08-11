from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Note, Bulletin


@receiver([post_save, post_delete], sender=Note)
def recalculer_classement_apres_note(sender, instance, **kwargs):
    """
    Dès qu'une note change, on recalcule TOUTE la classe concernée
    (pas seulement l'élève dont la note a changé), car son rang à lui
    ET celui de ses camarades peuvent tous les deux évoluer.
    """
    Bulletin.recalculer_classement(
        classe=instance.classe,
        annee_scolaire=instance.annee_scolaire,
        trimestre=instance.trimestre,
    )