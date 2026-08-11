from django.apps import AppConfig


class AcademiqueConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "academique"

    def ready(self):
        import academique.signals  # branche les signaux au démarrage de Django