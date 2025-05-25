const socket = io();

let pseudo = null;

while (!pseudo) {
    pseudo = prompt("Choisis un pseudo :");
    if (pseudo) pseudo = pseudo.trim();
}

socket.emit('nouveau_utilisateur', pseudo);

const chat = document.getElementById('chat');
const form = document.getElementById('form');
const messageInput = document.getElementById('message');
const userList = document.getElementById('userList');
const typingIndicator = document.getElementById('typing');

const userReactions = {}; // { messageId: Set(emoji) }

function addSystemMessage(text) {
    const div = document.createElement('div');
    div.className = 'system-message';
    div.textContent = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

socket.on('message', (msg) => {
    addMessageToChat(msg);
});

socket.on('userJoined', (user) => {
    addSystemMessage(`${user} a rejoint le chat.`);
});

socket.on('userLeft', (user) => {
    addSystemMessage(`${user} a quitté le chat.`);
});

socket.on('deleteMessage', (id) => {
    const msg = document.querySelector(`[data-id='${id}']`);
    if (msg) msg.remove();
});

socket.on('editMessage', (msgData) => {
    const msg = document.querySelector(`[data-id='${msgData.id}']`);
    if (msg) {
        const isSelf = msgData.pseudo === pseudo;
        msg.innerHTML = `<strong>${msgData.pseudo}</strong><br>${escapeHtml(msgData.texte)}<span class="time">${msgData.time}</span>`;

        if (isSelf) {
            const controls = document.createElement('div');
            controls.className = 'controls';

            const del = document.createElement('button');
            del.textContent = '🗑️';
            del.title = 'Supprimer le message';
            del.onclick = () => socket.emit('deleteMessage', msgData.id);
            controls.appendChild(del);

            const edit = document.createElement('button');
            edit.textContent = '✏️';
            edit.title = 'Modifier le message';
            edit.onclick = () => {
                const newTexte = prompt('Modifier le message :', msgData.texte);
                if (newTexte && newTexte.trim() !== '') {
                    socket.emit('editMessage', { id: msgData.id, texte: newTexte });
                }
            };
            controls.appendChild(edit);

            msg.appendChild(controls);
        }

        // Reactions container (empty, will be updated by reaction events)
        let reactionsDisplay = msg.querySelector('.reactions-display');
        if (!reactionsDisplay) {
            reactionsDisplay = document.createElement('div');
            reactionsDisplay.className = 'reactions-display';
            msg.appendChild(reactionsDisplay);
        }
    }
});

socket.on('updateUserList', (users) => {
    userList.textContent = `Utilisateurs connectés : ${users.join(', ')}`;
});

let typingTimeout;
socket.on('typing', (user) => {
    if (user !== pseudo) {
        typingIndicator.textContent = `${user} est en train d’écrire...`;
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            typingIndicator.textContent = '';
        }, 2000);
    }
});

messageInput.addEventListener('input', () => {
    socket.emit('typing', pseudo);
});

function addMessageToChat(msg) {
    const isSelf = msg.pseudo === pseudo;

    const div = document.createElement('div');
    div.className = 'message';
    div.dataset.id = msg.id;
    div.style.borderLeft = `5px solid ${msg.couleur}`;
    div.innerHTML = `<strong>${msg.pseudo}</strong><br>${escapeHtml(msg.texte)}<span class="time">${msg.time}</span>`;

    if (isSelf) {
        const controls = document.createElement('div');
        controls.className = 'controls';

        const del = document.createElement('button');
        del.textContent = '🗑️';
        del.title = 'Supprimer le message';
        del.onclick = () => socket.emit('deleteMessage', msg.id);
        controls.appendChild(del);

        const edit = document.createElement('button');
        edit.textContent = '✏️';
        edit.title = 'Modifier le message';
        edit.onclick = () => {
            const newTexte = prompt('Modifier le message :', msg.texte);
            if (newTexte && newTexte.trim() !== '') {
                socket.emit('editMessage', { id: msg.id, texte: newTexte });
            }
        };
        controls.appendChild(edit);

        div.appendChild(controls);
    }

    // Réactions affichées
    const reactionsDisplay = document.createElement('div');
    reactionsDisplay.className = 'reactions-display';
    div.appendChild(reactionsDisplay);

    // Bouton "+" pour ouvrir le menu des réactions
    const addReactionBtn = document.createElement('button');
    addReactionBtn.textContent = '➕';
    addReactionBtn.className = 'add-reaction-btn';
    div.appendChild(addReactionBtn);

    // Menu des réactions (caché au départ)
    const reactionMenu = document.createElement('div');
    reactionMenu.className = 'reaction-menu';
    reactionMenu.style.display = 'none';

    const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
    emojis.forEach((emoji) => {
        const btn = document.createElement('button');
        btn.className = 'reaction-btn';
        btn.textContent = emoji;
        btn.title = `Réagir avec ${emoji}`;

        btn.onclick = (e) => {
            e.stopPropagation();
            toggleReaction(msg.id, emoji, reactionsDisplay);
        };

        reactionMenu.appendChild(btn);
    });
    div.appendChild(reactionMenu);

    // Ouvrir / fermer menu réactions
    addReactionBtn.onclick = (e) => {
        e.stopPropagation();
        if (reactionMenu.style.display === 'none') {
            reactionMenu.style.display = 'block';
            addReactionBtn.style.display = 'none';
        }
    };

    // Clic hors menu ferme le menu et remet le "+"
    document.addEventListener('click', () => {
        reactionMenu.style.display = 'none';
        addReactionBtn.style.display = 'inline-block';
    });

    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

function toggleReaction(messageId, emoji, reactionsDisplay) {
    if (!userReactions[messageId]) {
        userReactions[messageId] = new Set();
    }

    if (userReactions[messageId].has(emoji)) {
        socket.emit('removeReaction', { messageId, emoji });
        userReactions[messageId].delete(emoji);
    } else {
        socket.emit('addReaction', { messageId, emoji });
        userReactions[messageId].add(emoji);
    }
}

socket.on('reactionAdded', ({ messageId, emoji, count }) => {
    updateReactionDisplay(messageId, emoji, count);
});

socket.on('reactionRemoved', ({ messageId, emoji, count }) => {
    updateReactionDisplay(messageId, emoji, count);
});

function updateReactionDisplay(messageId, emoji, count) {
    const msg = document.querySelector(`[data-id='${messageId}']`);
    if (!msg) return;

    let reactionsDisplay = msg.querySelector('.reactions-display');
    if (!reactionsDisplay) {
        reactionsDisplay = document.createElement('div');
        reactionsDisplay.className = 'reactions-display';
        msg.appendChild(reactionsDisplay);
    }

    let reactionSpan = reactionsDisplay.querySelector(`[data-emoji='${emoji}']`);

    if (!reactionSpan) {
        reactionSpan = document.createElement('span');
        reactionSpan.dataset.emoji = emoji;
        reactionSpan.className = 'reaction-count';
        reactionsDisplay.appendChild(reactionSpan);
    }

    if (count === 0) {
        reactionSpan.remove();
    } else {
        reactionSpan.textContent = `${emoji} ${count}`;
    }
}

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (message !== '') {
        socket.emit('message', message);
        messageInput.value = '';
    }
});