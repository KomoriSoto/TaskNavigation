from django.contrib import admin
from .models import ConcentrationLog


@admin.register(ConcentrationLog)
class ConcentrationLogAdmin(admin.ModelAdmin):
    list_display = ("user", "record_date", "duration_minutes", "average_score", "score_label")
    list_filter = ("record_date",)
    search_fields = ("user__email",)
    ordering = ("-record_date",)
