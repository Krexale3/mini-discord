const socket = io();
let username = prompt("Choisis un pseudo :");

const form = document.getElementById('form');
const input = document.getElementById('message');
const chat = document.getElementById('chat');

form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value) {
        socket.emit('sendMessage', {
            username,
            message: input.value
        });
        input.value = '';
    }
});

socket.on('chatMessage', ({ username, message }) => {
    const item = document.createElement('div');
    item.textContent = `${username}: ${message}`;
    chat.appendChild(item);
    chat.scrollTop = chat.scrollHeight;
});