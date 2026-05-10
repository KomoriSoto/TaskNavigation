from django.urls import path
from . import views

app_name = "tasks"

urlpatterns = [
    path("", views.kanban_view, name="kanban"),
    # API
    path("api/create/", views.task_create_api, name="api_create"),
    path("api/<int:pk>/update/", views.task_update_api, name="api_update"),
    path("api/<int:pk>/move/", views.task_move_api, name="api_move"),
    path("api/<int:pk>/delete/", views.task_delete_api, name="api_delete"),
]
