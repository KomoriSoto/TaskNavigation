import json
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import ConcentrationLog


@login_required
def measure_view(request):
    """Render the live concentration measurement page."""
    focus_items = [
        {"id": 1,  "name": "Posture"},
        {"id": 2,  "name": "Eye rest"},
        {"id": 3,  "name": "Deep work"},
        {"id": 4,  "name": "No distractions"},
        {"id": 5,  "name": "Breathing"},
        {"id": 6,  "name": "Note-taking"},
        {"id": 7,  "name": "Stay hydrated"},
        {"id": 8,  "name": "Time-boxing"},
    ]
    return render(request, "concentration/measure.html", {"focus_items": focus_items})


@login_required
def list_view(request):
    """Paginated list of the user's concentration logs."""
    logs_qs = ConcentrationLog.objects.filter(user=request.user, average_score__gt=0)
    paginator = Paginator(logs_qs, 10)
    page_obj = paginator.get_page(request.GET.get("page"))
    return render(request, "concentration/list.html", {"page_obj": page_obj})


@login_required
def detail_view(request, pk):
    """Detail view for a single concentration log."""
    log = get_object_or_404(ConcentrationLog, pk=pk, user=request.user)
    return render(request, "concentration/detail.html", {
        "log": log,
        "score_records": log.score_records or [],
    })


@login_required
@require_http_methods(["POST"])
def delete_view(request, pk):
    """Soft-delete: simply remove the record (hard delete for simplicity)."""
    log = get_object_or_404(ConcentrationLog, pk=pk, user=request.user)
    log.delete()
    return redirect("concentration:list")


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def save_api(request):
    """
    API endpoint called by the browser when a measurement session ends.
    Accepts JSON matching Timely's concentration_save_api format.
    """
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "message": "Invalid JSON."}, status=400)

    focus_items = data.get("focus_items") or []

    log = ConcentrationLog.objects.create(
        user=request.user,
        record_date=timezone.now(),
        duration_minutes=int(data.get("duration_minutes", 0)),
        average_score=float(data.get("average_score", 0)),
        max_score=float(data.get("max_score", 0)),
        min_score=float(data.get("min_score", 0)),
        gaze_stability_avg=data.get("gaze_stability_avg"),
        posture_score_avg=data.get("posture_score_avg"),
        face_direction_avg=data.get("face_direction_avg"),
        center_focus_avg=data.get("center_focus_avg"),
        score_records=data.get("score_records", []),
        focus_items=focus_items,
    )

    return JsonResponse({
        "success": True,
        "message": "Concentration log saved.",
        "log_id": log.pk,
    }, status=201)
