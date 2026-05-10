from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from dashboard.views import root_view



urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("accounts.urls", namespace="accounts")),
    path("tasks/", include("tasks.urls", namespace="tasks")),
    path("concentration/", include("concentration.urls", namespace="concentration")),
    path("dashboard/", include("dashboard.urls", namespace="dashboard")),
    path("", root_view, name="root"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
