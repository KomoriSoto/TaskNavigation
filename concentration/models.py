from django.db import models
from django.conf import settings
from django.utils import timezone


class ConcentrationLog(models.Model):
    """
    Records a single concentration measurement session.
    Data format mirrors the Timely project for compatibility.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="concentration_logs",
    )
    record_date = models.DateTimeField(default=timezone.now)
    duration_minutes = models.IntegerField()
    average_score = models.FloatField()
    max_score = models.FloatField()
    min_score = models.FloatField()
    gaze_stability_avg = models.FloatField(null=True, blank=True)
    posture_score_avg = models.FloatField(null=True, blank=True)
    face_direction_avg = models.FloatField(null=True, blank=True)
    center_focus_avg = models.FloatField(null=True, blank=True)
    # 5-minute interval score snapshots: [{"minute": 5, "score": 72.3, ...}, ...]
    score_records = models.JSONField(default=list)
    # Items the user chose to focus on: [{"id": 1, "name": "Posture"}, ...]
    focus_items = models.JSONField(default=list)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "concentration_logs"
        ordering = ["-record_date"]
        verbose_name = "Concentration Log"
        verbose_name_plural = "Concentration Logs"

    def __str__(self):
        return f"{self.user} — {self.record_date:%Y-%m-%d %H:%M} (avg {self.average_score:.1f})"

    @property
    def score_label(self):
        if self.average_score >= 80:
            return "Excellent"
        if self.average_score >= 60:
            return "Good"
        if self.average_score >= 40:
            return "Fair"
        return "Poor"
