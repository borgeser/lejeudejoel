from django.urls import path
from django.views.generic import TemplateView


urlpatterns = [
    path('', TemplateView.as_view(template_name='game_client/index.html')),
    path('local', TemplateView.as_view(template_name='game_client/game.html')),
    path('<str:room_name>/<str:team>', TemplateView.as_view(template_name='game_client/game.html')),
]
