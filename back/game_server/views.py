from django.shortcuts import render


def index(request):
    return render(request, 'game_server/index.html')
