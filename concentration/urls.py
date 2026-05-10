from django.urls import path
from . import views

app_name = "concentration"

urlpatterns = [
    path("", views.list_view, name="list"),
    path("measure/", views.measure_view, name="measure"),
    path("<int:pk>/", views.detail_view, name="detail"),
    path("<int:pk>/delete/", views.delete_view, name="delete"),
    path("api/save/", views.save_api, name="api_save"),
]
