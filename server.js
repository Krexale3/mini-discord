const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dayjs = require('dayjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let users = {}; // socket.id => pseudo
let messages = []; // { id, pseudo, texte, time, couleur }
let reactions = {};
// Format : { messageId: { emoji: { count: Number, users: Set(pseudo) } } }

function generateId() {
    return Math.random().toString(36).substring(2, 10);
}

function getRandomColor() {
    const colors = ['#e21400', '#91580f', '#f8a700', '#f78b00', '#58dc00', '#287b00', '#a8f07a', '#4ae8c4', '#3b88eb', '#3824aa', '#a700ff', '#d300e7'];
    return colors[Math.floor(Math.random() * colors.length)];
}

io.on('connection', (socket) => {
    let userPseudo = null;

    socket.on('nouveau_utilisateur', (pseudo) => {
        userPseudo = pseudo;
        users[socket.id] = pseudo;
        io.emit('updateUserList', Object.values(users));
        io.emit('userJoined', pseudo);
    });

    socket.on('message', (texte) => {
        if (!userPseudo) return;
        const id = generateId();
        const time = dayjs().format('HH:mm');
        const couleur = getRandomColor();

        const msg = { id, pseudo: userPseudo, texte, time, couleur };
        messages.push(msg);
        io.emit('message', msg);
    });

    socket.on('deleteMessage', (id) => {
        const index = messages.findIndex(m => m.id === id && m.pseudo === userPseudo);
        if (index !== -1) {
            messages.splice(index, 1);
            io.emit('deleteMessage', id);

            // Nettoyer les réactions associées
            if (reactions[id]) delete reactions[id];
        }
    });

    socket.on('editMessage', ({ id, texte }) => {
        const msg = messages.find(m => m.id === id && m.pseudo === userPseudo);
        if (msg) {
            msg.texte = texte;
            msg.time = dayjs().format('HH:mm');
            io.emit('editMessage', msg);
        }
    });

    socket.on('typing', (pseudo) => {
        socket.broadcast.emit('typing', pseudo);
    });

    socket.on('addReaction', ({ messageId, emoji }) => {
        if (!userPseudo) return;

        if (!reactions[messageId]) reactions[messageId] = {};
        if (!reactions[messageId][emoji]) reactions[messageId][emoji] = { count: 0, users: new Set() };

        const reactionInfo = reactions[messageId][emoji];

        if (!reactionInfo.users.has(userPseudo)) {
            reactionInfo.users.add(userPseudo);
            reactionInfo.count++;
            io.emit('reactionAdded', { messageId, emoji, count: reactionInfo.count });
        }
    });

    socket.on('removeReaction', ({ messageId, emoji }) => {
        if (!userPseudo) return;

        if (reactions[messageId] && reactions[messageId][emoji]) {
            const reactionInfo = reactions[messageId][emoji];
            if (reactionInfo.users.has(userPseudo)) {
                reactionInfo.users.delete(userPseudo);
                reactionInfo.count--;
                if (reactionInfo.count < 0) reactionInfo.count = 0;
                io.emit('reactionRemoved', { messageId, emoji, count: reactionInfo.count });
            }
        }
    });

    socket.on('disconnect', () => {
        if (userPseudo) {
            delete users[socket.id];
            io.emit('updateUserList', Object.values(users));
            io.emit('userLeft', userPseudo);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur lancé sur le port ${PORT}`);
    console.log(`http://localhost:${PORT}`)
});