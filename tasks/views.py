import json
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views.decorators.http import require_http_methods

from .forms import TaskForm
from .models import Task


@login_required
def kanban_view(request):
    tasks = Task.objects.filter(user=request.user)
    columns = [
        {
            "key": "todo",
            "label": "Todo",
            "css": "col-todo",
            "tasks": list(tasks.filter(status=Task.Status.TODO)),
        },
        {
            "key": "in_progress",
            "label": "In Progress",
            "css": "col-progress",
            "tasks": list(tasks.filter(status=Task.Status.IN_PROGRESS)),
        },
        {
            "key": "review",
            "label": "Review",
            "css": "col-review",
            "tasks": list(tasks.filter(status=Task.Status.REVIEW)),
        },
        {
            "key": "done",
            "label": "Done",
            "css": "col-done",
            "tasks": list(tasks.filter(status=Task.Status.DONE)),
        },
    ]
    form = TaskForm()
    return render(request, "tasks/kanban.html", {"columns": columns, "form": form})


# ── API endpoints (JSON) ────────────────────────────────────────────────────

@login_required
@require_http_methods(["POST"])
def task_create_api(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    form = TaskForm(data)
    if form.is_valid():
        task = form.save(commit=False)
        task.user = request.user
        task.save()
        return JsonResponse({"success": True, "task": _task_to_dict(task)}, status=201)
    return JsonResponse({"error": form.errors}, status=400)


@login_required
@require_http_methods(["PUT"])
def task_update_api(request, pk):
    task = get_object_or_404(Task, pk=pk, user=request.user)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    form = TaskForm(data, instance=task)
    if form.is_valid():
        form.save()
        return JsonResponse({"success": True, "task": _task_to_dict(task)})
    return JsonResponse({"error": form.errors}, status=400)


@login_required
@require_http_methods(["POST"])
def task_move_api(request, pk):
    """Update only the status (column) and position of a task — used by drag-and-drop."""
    task = get_object_or_404(Task, pk=pk, user=request.user)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    new_status = data.get("status")
    if new_status not in Task.Status.values:
        return JsonResponse({"error": "Invalid status."}, status=400)

    task.status = new_status
    task.position = data.get("position", 0)
    task.save(update_fields=["status", "position"])
    return JsonResponse({"success": True})


@login_required
@require_http_methods(["DELETE"])
def task_delete_api(request, pk):
    task = get_object_or_404(Task, pk=pk, user=request.user)
    task.delete()
    return JsonResponse({"success": True})


# ── Helpers ─────────────────────────────────────────────────────────────────

def _task_to_dict(task: Task) -> dict:
    return {
        "id": task.pk,
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "is_overdue": task.is_overdue,
        "created_at": task.created_at.isoformat(),
    }
