from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from django.utils import timezone

from tasks.models import Task
from concentration.models import ConcentrationLog


def root_view(request):
    if request.user.is_authenticated:
        return redirect("dashboard:index")
    return redirect("accounts:login")


@login_required
def index_view(request):
    user = request.user
    tasks = Task.objects.filter(user=user)

    task_counts = {
        "todo": tasks.filter(status=Task.Status.TODO).count(),
        "in_progress": tasks.filter(status=Task.Status.IN_PROGRESS).count(),
        "review": tasks.filter(status=Task.Status.REVIEW).count(),
        "done": tasks.filter(status=Task.Status.DONE).count(),
    }
    task_counts["total"] = sum(task_counts.values())

    overdue_tasks = [t for t in tasks.filter(
        due_date__lt=timezone.localdate(),
    ).exclude(status=Task.Status.DONE)[:5]]

    recent_logs = ConcentrationLog.objects.filter(
        user=user, average_score__gt=0
    )[:5]

    # Weekly concentration average (last 7 days)
    from datetime import timedelta
    week_ago = timezone.now() - timedelta(days=7)
    weekly_logs = ConcentrationLog.objects.filter(
        user=user, record_date__gte=week_ago, average_score__gt=0
    )
    weekly_avg = None
    if weekly_logs.exists():
        weekly_avg = round(
            sum(l.average_score for l in weekly_logs) / weekly_logs.count(), 1
        )

    return render(request, "dashboard/index.html", {
        "task_counts": task_counts,
        "overdue_tasks": overdue_tasks,
        "recent_logs": recent_logs,
        "weekly_avg": weekly_avg,
    })
