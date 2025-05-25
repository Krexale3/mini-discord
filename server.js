const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Un utilisateur connecté');

    socket.on('sendMessage', ({ username, message }) => {
        io.emit('chatMessage', { username, message });
    });

    socket.on('disconnect', () => {
        console.log('Un utilisateur s\'est déconnecté');
    });
});

http.listen(3000, () => {
    console.log('Serveur démarré sur http://localhost:3000');
});