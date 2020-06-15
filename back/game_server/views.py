from django.shortcuts import render


def index(request):
    return render(request, 'game_server/index.html')


def room(request, room_name):
    return render(request, 'game_server/room.html', {
        'room_name': room_name
    })
