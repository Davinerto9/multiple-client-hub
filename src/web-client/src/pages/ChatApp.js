export default function ChatApp(username) {
    const container = document.createElement('div');
    container.classList.add('chat-container');

    // ============================================
    // 1. Verificar / Re-conectar ICE si es necesario
    // ============================================
    async function ensureIceConnection() {
        // Si no hay proxy activo, intentar crear/reconectar
        if (!window.ChatService || !window.ChatService.chatServicePrx) {
            console.warn('Ice no está inicializado, intentando reconectar...');

            // 1) Verificar que las librerías están disponibles
            if (!window.Ice || !window.ChatApp) {
                console.error('Ice.js o Chat.js no están cargados');
                sessionStorage.removeItem('username');
                sessionStorage.removeItem('iceConnected');

                const app = document.getElementById('app');
                if (app) {
                    app.innerHTML = '';
                    const { Home } = await import('./Home.js');
                    app.appendChild(Home());
                }
                return false;
            }

            const savedUsername = sessionStorage.getItem('username');
            const iceWasConnected = sessionStorage.getItem('iceConnected') === 'true';

            if (savedUsername && iceWasConnected) {
                console.log('Reconectando Ice para usuario:', savedUsername);

                try {
                    const reconnected = await window.ChatService.initialize(savedUsername, {
                        onMessage: (data) => {
                            console.log('Mensaje recibido (reconexión):', data);
                            if (window.currentChatApp && window.currentChatApp.handleIncomingMessage) {
                                window.currentChatApp.handleIncomingMessage(data);
                            }
                        },
                        onVoiceNote: (data) => {
                            console.log('Audio recibido (reconexión):', data);
                            if (window.currentChatApp && window.currentChatApp.handleIncomingVoiceNote) {
                                window.currentChatApp.handleIncomingVoiceNote(data);
                            }
                        },
                        onCall: (data) => {
                            console.log('Llamada (reconexión):', data);
                            if (window.currentChatApp && window.currentChatApp.handleCallEvent) {
                                window.currentChatApp.handleCallEvent(data);
                            }
                        },
                        onUserStatus: (data) => {
                            console.log('Estado usuario (reconexión):', data);
                            if (window.currentChatApp && window.currentChatApp.handleUserStatusChange) {
                                window.currentChatApp.handleUserStatusChange(data);
                            }
                        },
                        onGroupUpdate: (data) => {
                            console.log('Grupo actualizado (reconexión):', data);
                            if (window.currentChatApp && window.currentChatApp.handleGroupUpdate) {
                                window.currentChatApp.handleGroupUpdate(data);
                            }
                        }
                    });

                    if (reconnected) {
                        console.log('Ice reconectado correctamente');
                        return true;
                    }
                } catch (error) {
                    console.error('Error reconectando Ice:', error);
                }
            }

            // 2) Si llegamos aquí es que no se pudo conectar/reconectar
            console.log('Redirigiendo a Home...');
            sessionStorage.removeItem('username');
            sessionStorage.removeItem('iceConnected');

            const app = document.getElementById('app');
            if (app) {
                app.innerHTML = '';
                const { Home } = await import('./Home.js');
                app.appendChild(Home());
            }

            return false;
        }

        // Ya hay proxy válido
        return true;
    }

    // ============================================
    // 2. Estado de la aplicación
    // ============================================
    let selectedChat = null;
    let chatType = null; // 'private' | 'group'
    let currentUser = username;

    let messages = [];
    let users = [];
    let groups = [];

    let currentView = 'chat'; // 'chat' | 'history'
    let historyData = [];
    let messageCache = {};

    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;
    let callStates = {}; // callId -> 'ringing' | 'active'
    let replyToMessage = null;  // { sender, content, timestamp }


    // Captura PCM para llamada
    let callAudioContext = null;
    let callSourceNode = null;
    let callProcessorNode = null;
    let callMicStream = null;

    // Reproducción PCM para llamada
    let callPlaybackContext = null;
    let callPlaybackQueue = [];
    let callPlaybackPlaying = false;



    // Referencias DOM
    let usersListElement = null;
    let groupsListElement = null;
    const mainChat = document.createElement('div');
    mainChat.classList.add('main-chat');
    mainChat.id = 'mainChat';

    // ============================================
    // 3. Carga inicial de datos
    // ============================================
    async function loadInitialData() {
        try {
            console.log('═══════════════════════════════════════════');
            console.log('Cargando datos iniciales...');

            const ok = await ensureIceConnection();
            if (!ok) return;

            if (!window.ChatService || !window.ChatService.chatServicePrx) {
                throw new Error('ChatService no está inicializado');
            }

            console.log('ChatService verificado');
            console.log('Usuario actual:', window.ChatService.currentUser);

            users = [];
            groups = [];

            // Usuarios conectados
            try {
                console.log('👥 Obteniendo usuarios conectados...');
                const usersData = await window.ChatService.getConnectedUsers();
                console.log('   Respuesta raw:', usersData);

                if (Array.isArray(usersData)) {
                    users = usersData.filter(u => u && u !== username);
                } else if (usersData && typeof usersData === 'object') {
                    users = Object.values(usersData).filter(u => u && u !== username);
                } else {
                    console.warn('Formato de usuarios inesperado');
                    users = [];
                }
                console.log('Usuarios:', users);
            } catch (err) {
                console.error('Error cargando usuarios:', err);
                users = [];
            }

            // Grupos
            try {
                console.log('Obteniendo grupos...');
                const groupsData = await window.ChatService.getAllGroups();
                console.log('   Respuesta raw:', groupsData);

                if (Array.isArray(groupsData)) {
                    groups = groupsData;
                } else {
                    console.warn('Formato de grupos inesperado');
                    groups = [];
                }
                console.log('Grupos:', groups);
            } catch (err) {
                console.error('Error cargando grupos:', err);
                groups = [];
            }

            renderUsersList();
            renderGroupsList();

            console.log('Datos iniciales cargados');
            console.log('Usuarios:', users.length);
            console.log('Grupos:', groups.length);
            console.log('═══════════════════════════════════════════');
        } catch (err) {
            console.error('ERROR CRÍTICO cargando datos iniciales:', err);

            const main = document.getElementById('mainChat');
            if (main) {
                main.innerHTML = '';

                const wrapper = document.createElement('div');
                wrapper.style.padding = '40px';
                wrapper.style.textAlign = 'center';
                wrapper.style.background =
                    'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)';
                wrapper.style.borderRadius = '12px';
                wrapper.style.margin = '20px';

                const icon = document.createElement('div');
                icon.style.fontSize = '48px';
                icon.style.marginBottom = '20px';
                icon.textContent = '⚠️';

                const title = document.createElement('h3');
                title.style.color = '#dc2626';
                title.style.marginBottom = '10px';
                title.textContent = 'Error de Conexión';

                const msg = document.createElement('p');
                msg.style.color = '#991b1b';
                msg.style.marginBottom = '20px';
                msg.textContent = err.message;

                const tipsBox = document.createElement('div');
                tipsBox.style.background = '#fff';
                tipsBox.style.padding = '15px';
                tipsBox.style.borderRadius = '8px';
                tipsBox.style.margin = '20px auto';
                tipsBox.style.maxWidth = '400px';
                tipsBox.style.textAlign = 'left';

                const tip1 = document.createElement('p');
                tip1.style.fontSize = '0.9em';
                tip1.style.color = '#666';
                tip1.style.margin = '5px 0';
                tip1.textContent = '✓ Verifica que el servidor Java esté corriendo';

                const tip2 = document.createElement('p');
                tip2.style.fontSize = '0.9em';
                tip2.style.color = '#666';
                tip2.style.margin = '5px 0';
                tip2.textContent = '✓ Confirma que el puerto sea 12345';

                const tip3 = document.createElement('p');
                tip3.style.fontSize = '0.9em';
                tip3.style.color = '#666';
                tip3.style.margin = '5px 0';
                tip3.textContent = '✓ Revisa la consola del servidor Java';

                tipsBox.appendChild(tip1);
                tipsBox.appendChild(tip2);
                tipsBox.appendChild(tip3);

                const reloadBtn = document.createElement('button');
                reloadBtn.textContent = 'Recargar Página';
                reloadBtn.style.marginTop = '15px';
                reloadBtn.style.padding = '12px 24px';
                reloadBtn.style.background = '#3b82f6';
                reloadBtn.style.color = '#fff';
                reloadBtn.style.border = 'none';
                reloadBtn.style.borderRadius = '8px';
                reloadBtn.style.cursor = 'pointer';
                reloadBtn.style.fontSize = '16px';
                reloadBtn.style.fontWeight = '600';
                reloadBtn.addEventListener('click', () => location.reload());

                wrapper.appendChild(icon);
                wrapper.appendChild(title);
                wrapper.appendChild(msg);
                wrapper.appendChild(tipsBox);
                wrapper.appendChild(reloadBtn);

                main.appendChild(wrapper);
            }

            users = [];
            groups = [];
            renderUsersList();
            renderGroupsList();
        }
    }

    // ============================================
    // 4. Sidebar (usuarios / grupos / logout)
    // ============================================
    function createSidebar() {
        const sidebar = document.createElement('div');
        sidebar.classList.add('sidebar');

        // Header usuario
        const sidebarHeader = document.createElement('div');
        sidebarHeader.classList.add('sidebar-header');

        const userInfo = document.createElement('div');
        userInfo.classList.add('user-info');

        const userInfoText = document.createElement('div');
        const headerTitle = document.createElement('h2');
        headerTitle.textContent = 'Chat App';
        const headerSubtitle = document.createElement('p');
        headerSubtitle.textContent = `Logged in as: ${username}`;
        userInfoText.appendChild(headerTitle);
        userInfoText.appendChild(headerSubtitle);

        const logoutBtn = document.createElement('button');
        logoutBtn.classList.add('logout-btn');
        const logoutIcon = document.createElement('span');
        logoutIcon.classList.add('icon-logout');
        logoutBtn.appendChild(logoutIcon);
        logoutBtn.appendChild(document.createTextNode(' Logout'));
        logoutBtn.addEventListener('click', handleLogout);

        userInfo.appendChild(userInfoText);
        userInfo.appendChild(logoutBtn);
        sidebarHeader.appendChild(userInfo);

        // Crear grupo
        const createGroupSection = document.createElement('div');
        createGroupSection.classList.add('create-group-section');

        const createGroupBtn = document.createElement('button');
        createGroupBtn.classList.add('create-group-btn');
        const createIcon = document.createElement('span');
        createIcon.classList.add('icon-group');
        createGroupBtn.appendChild(createIcon);
        createGroupBtn.appendChild(document.createTextNode(' Create Group'));
        createGroupBtn.addEventListener('click', showGroupModal);

        createGroupSection.appendChild(createGroupBtn);

        // Eliminar grupo
        const deleteGroupSection = document.createElement('div');
        deleteGroupSection.classList.add('delete-group-section');

        const deleteGroupBtn = document.createElement('button');
        deleteGroupBtn.classList.add('delete-group-btn');
        const trashIcon = document.createElement('span');
        trashIcon.classList.add('icon-trash');
        deleteGroupBtn.appendChild(trashIcon);
        deleteGroupBtn.appendChild(document.createTextNode(' Delete Group'));
        deleteGroupBtn.addEventListener('click', showDeleteGroupModal);

        deleteGroupSection.appendChild(deleteGroupBtn);

        // Listas
        const chatListSection = document.createElement('div');
        chatListSection.classList.add('chat-list-section');

        const usersHeader = document.createElement('div');
        usersHeader.classList.add('chat-list-header');
        usersHeader.textContent = 'USERS';

        const usersList = document.createElement('div');
        usersList.id = 'usersList';
        usersListElement = usersList;

        const groupsHeader = document.createElement('div');
        groupsHeader.classList.add('chat-list-header');
        groupsHeader.textContent = 'GROUPS';
        groupsHeader.style.marginTop = '20px';

        const groupsList = document.createElement('div');
        groupsList.id = 'groupsList';
        groupsListElement = groupsList;

        chatListSection.appendChild(usersHeader);
        chatListSection.appendChild(usersList);
        chatListSection.appendChild(groupsHeader);
        chatListSection.appendChild(groupsList);

        sidebar.appendChild(sidebarHeader);
        sidebar.appendChild(createGroupSection);
        sidebar.appendChild(deleteGroupSection);
        sidebar.appendChild(chatListSection);

        return sidebar;
    }

    // ============================================
    // 5. Render de listas y main chat
    // ============================================
    function renderUsersList() {
        if (!usersListElement) return;
        usersListElement.innerHTML = '';

        users.forEach(user => {
            const item = document.createElement('div');
            item.classList.add('chat-item');
            item.dataset.user = user;

            if (selectedChat === user && chatType === 'private') {
                item.classList.add('active');
            }

            const icon = document.createElement('span');
            icon.classList.add('chat-icon', 'icon-user');

            const label = document.createElement('span');
            label.textContent = user;

            item.appendChild(icon);
            item.appendChild(label);

            item.addEventListener('click', () => selectChat(user, 'private'));
            usersListElement.appendChild(item);
        });
    }

    function renderGroupsList() {
        if (!groupsListElement) return;
        groupsListElement.innerHTML = '';

        groups.forEach(group => {
            const name = typeof group === 'string' ? group : group.name;

            const item = document.createElement('div');
            item.classList.add('chat-item');
            item.dataset.group = name;

            if (selectedChat === name && chatType === 'group') {
                item.classList.add('active');
            }

            const icon = document.createElement('span');
            icon.classList.add('chat-icon', 'icon-group');

            const label = document.createElement('span');
            label.textContent = name;

            item.appendChild(icon);
            item.appendChild(label);

            item.addEventListener('click', () => selectChat(name, 'group'));
            groupsListElement.appendChild(item);
        });
    }

    function selectChat(chatName, type) {
        const chatKey = `${type}_${chatName}`;

        if (selectedChat) {
            const currentKey = `${chatType}_${selectedChat}`;
            messageCache[currentKey] = [...messages];
        }

        selectedChat = chatName;
        chatType = type;

        messages = messageCache[chatKey] ? [...messageCache[chatKey]] : [];

        currentView = 'chat';
        renderUsersList();
        renderGroupsList();
        renderMainChat();

        refreshMessages().catch(err => console.error('Error refreshing messages:', err));
    }

    function renderMainChat() {
        mainChat.innerHTML = '';

        if (!selectedChat) {
            renderEmptyState();
            return;
        }

        if (currentView === 'history') {
            renderHistoryView();
            return;
        }

        const chatHeader = createChatHeader();
        const messagesContainer = createMessagesContainer();
        const inputContainer = createInputContainer();

        mainChat.appendChild(chatHeader);
        mainChat.appendChild(messagesContainer);
        mainChat.appendChild(inputContainer);

        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 0);
    }

    function renderEmptyState() {
        const emptyState = document.createElement('div');
        emptyState.classList.add('empty-state');

        const icon = document.createElement('div');
        icon.classList.add('empty-state-icon', 'icon-message');

        const text = document.createElement('p');
        text.textContent = 'Select a chat to start messaging';

        emptyState.appendChild(icon);
        emptyState.appendChild(text);
        mainChat.appendChild(emptyState);
    }

    function createChatHeader() {
        const header = document.createElement('div');
        header.classList.add('chat-header');

        const chatHeaderInfo = document.createElement('div');
        chatHeaderInfo.classList.add('chat-header-info');

        const chatTitle = document.createElement('h3');
        chatTitle.textContent = selectedChat;

        const chatSubtitle = document.createElement('p');
        chatSubtitle.textContent =
            chatType === 'private' ? 'Private Chat' : 'Group Chat';

        chatHeaderInfo.appendChild(chatTitle);
        chatHeaderInfo.appendChild(chatSubtitle);

        const actionsContainer = document.createElement('div');
        actionsContainer.classList.add('chat-actions');
        actionsContainer.style.display = 'flex';
        actionsContainer.style.gap = '10px';
        actionsContainer.style.alignItems = 'center';

        if (chatType === 'private' || chatType === 'group') {
            const voiceBtn = document.createElement('button');
            voiceBtn.classList.add('action-btn', 'voice-btn');
            voiceBtn.textContent = '🎤';
            voiceBtn.title = 'Send Voice Note';
            voiceBtn.addEventListener('click', startVoiceRecording);
            actionsContainer.appendChild(voiceBtn);
        }

        if (chatType === 'private') {
            const callBtn = document.createElement('button');
            callBtn.classList.add('action-btn', 'call-btn');
            callBtn.textContent = '📞';
            callBtn.title = 'Start Call';
            callBtn.addEventListener('click', () => initiateCall(selectedChat));
            actionsContainer.appendChild(callBtn);
        }

        if (chatType === 'group') {
            const manageBtn = document.createElement('button');
            manageBtn.classList.add('history-btn'); // reutiliza estilo
            manageBtn.textContent = 'Manage members';
            manageBtn.addEventListener('click', () => showManageGroupModal());
            header.appendChild(manageBtn);
        }

        const historyBtn = document.createElement('button');
        historyBtn.classList.add('history-btn');
        const histIcon = document.createElement('span');
        histIcon.classList.add('icon-history');
        historyBtn.appendChild(histIcon);
        historyBtn.appendChild(document.createTextNode(' View History'));
        historyBtn.addEventListener('click', loadHistory);

        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '🔄';
        refreshBtn.classList.add('refresh-btn');
        refreshBtn.title = 'Actualizar mensajes';
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.disabled = true;
            refreshBtn.textContent = '⏳';
            try {
                await refreshMessages();
            } catch (err) {
                console.error('Error actualizando chat:', err);
            } finally {
                refreshBtn.textContent = '🔄';
                refreshBtn.disabled = false;
            }
        });

        const clearBtn = document.createElement('button');
        clearBtn.classList.add('history-btn');
        clearBtn.textContent = 'Clear chat';

        clearBtn.addEventListener('click', async () => {
            if (!selectedChat) return;

            const name = typeof selectedChat === 'object' ? selectedChat.name : selectedChat;
            const confirmMsg =
                chatType === 'private'
                    ? `This will delete the entire history between you and ${name}.\nContinue?`
                    : `This will delete the entire history of group '${name}'.\nContinue?`;

            if (!confirm(confirmMsg)) return;

            try {
                let resp;
                if (chatType === 'private') {
                    resp = await window.ChatService.clearPrivateHistory(currentUser, name);
                } else {
                    resp = await window.ChatService.clearGroupHistory(name);
                }
                if (resp.status !== 'ok') {
                    throw new Error(resp.message || 'Backend error clearing history');
                }

                messages = [];
                const chatKey = chatType + ':' + name;
                messageCache[chatKey] = [];

                updateMessagesContainer(messages);
            } catch (e) {
                console.error('Error clearing chat:', e);
                alert('Error clearing chat: ' + e.message);
            }
        });

        header.appendChild(clearBtn);
        header.appendChild(chatHeaderInfo);
        header.appendChild(historyBtn);
        header.appendChild(refreshBtn);
        header.appendChild(actionsContainer);

        return header;
    }

    function createMessagesContainer() {
        const messagesContainer = document.createElement('div');
        messagesContainer.classList.add('messages-container');
        messagesContainer.id = 'messagesContainer';

        if (!messages || messages.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.classList.add('messages-empty');
            emptyMsg.textContent = 'No messages yet. Start the conversation!';
            messagesContainer.appendChild(emptyMsg);
        } else {
            messages.forEach(msg => {
                const wrapper = document.createElement('div');
                wrapper.classList.add('message-wrapper');
                wrapper.classList.add(msg.sender === username ? 'sent' : 'received');

                const message = document.createElement('div');
                message.classList.add('message');
                message.classList.add(msg.sender === username ? 'sent' : 'received');

                if (msg.sender !== username) {
                    const sender = document.createElement('div');
                    sender.classList.add('message-sender');
                    sender.textContent = msg.sender;
                    message.appendChild(sender);
                }

                const content = document.createElement('div');
                content.classList.add('message-content');

                const isAudio = msg.isAudio && msg.audioFile;
                const isCallStart = msg.isCallStart;
                const isCallEnd = msg.isCallEnd;

                if (isAudio) {
                    window.ChatService.getAudioFromHistory(msg.audioFile)
                        .then(bytes => {
                            if (bytes && bytes.length > 0) {
                                const uint8 = new Uint8Array(bytes);
                                const blob = new Blob([uint8], { type: 'audio/webm' });
                                const player = createAudioPlayer(blob);
                                content.appendChild(player);
                            } else {
                                content.textContent = '[Audio not available]';
                            }
                        })
                        .catch(err => {
                            console.error('Error cargando audio de historial:', err);
                            content.textContent = '[Error loading audio]';
                        });
                } else if (isCallStart || isCallEnd) {
                    const icon = document.createElement('span');
                    icon.classList.add('message-call-icon');
                    icon.textContent = '📞';

                    const label = document.createElement('span');
                    label.classList.add('message-call-label');
                    label.textContent = isCallStart ? 'Call started' : 'Call ended';

                    content.appendChild(icon);
                    content.appendChild(label);
                } else {
                    // 🔹 Parsear posible reply en msg.content
                    let raw = msg.content || '';
                    let replyMeta = null;

                    const replyRegex = /^\[REPLY:([^|]+)\|([^\]]+)\]\s*(.*)$/;
                    const m = raw.match(replyRegex);
                    if (m) {
                        replyMeta = { sender: m[1], timestamp: m[2] };
                        raw = m[3] || '';
                    }

                    if (replyMeta) {
                        const replyLine = document.createElement('div');
                        replyLine.style.fontSize = '0.75rem';
                        replyLine.style.opacity = '0.7';
                        replyLine.style.marginBottom = '2px';
                        replyLine.textContent =
                            `Replying to ${replyMeta.sender} (${replyMeta.timestamp})`;
                        content.appendChild(replyLine);
                    }

                    content.appendChild(document.createTextNode(raw));
                }

                const time = document.createElement('div');
                time.classList.add('message-time');
                time.textContent = msg.timestamp || '';

                message.appendChild(content);
                message.appendChild(time);

                // 🔹 Botón Reply solo para recibidos
                if (msg.sender !== username) {
                    const replyBtn = document.createElement('button');
                    replyBtn.textContent = 'Reply';
                    replyBtn.classList.add('reply-btn');
                    replyBtn.style.border = 'none';
                    replyBtn.style.background = 'transparent';
                    replyBtn.style.color = '#3b82f6';
                    replyBtn.style.cursor = 'pointer';
                    replyBtn.style.fontSize = '0.75rem';
                    replyBtn.style.marginTop = '4px';
                    replyBtn.style.alignSelf = 'flex-end';

                    replyBtn.addEventListener('click', () => {
                        replyToMessage = {
                            sender: msg.sender,
                            content: isAudio ? '[Audio message]' : (msg.content || ''),
                            timestamp: msg.timestamp || ''
                        };
                        const rc = document.getElementById('replyContainer');
                        const rt = document.getElementById('replyText');
                        if (rc && rt) {
                            rt.textContent =
                                `Replying to ${replyToMessage.sender}: "${replyToMessage.content}"`;
                            rc.classList.remove('hidden');
                        }
                        const input = document.getElementById('messageInput');
                        if (input) input.focus();
                    });

                    message.appendChild(replyBtn);
                }

                wrapper.appendChild(message);
                messagesContainer.appendChild(wrapper);
            });
        }

        return messagesContainer;
    }

    function showManageGroupModal() {
        const groupName = typeof selectedChat === 'object' ? selectedChat.name : selectedChat;
        if (!groupName || chatType !== 'group') return;

        // Buscar grupo actual para mostrar miembros
        const groupObj = groups.find(g => {
            const name = typeof g === 'string' ? g : g.name;
            return name === groupName;
        });
        const membersList = groupObj && groupObj.members ? groupObj.members : [];

        const overlay = document.createElement('div');
        overlay.classList.add('modal-overlay', 'show');

        const content = document.createElement('div');
        content.classList.add('modal-content');

        const title = document.createElement('h3');
        title.textContent = `Manage members: ${groupName}`;

        const info = document.createElement('p');
        info.textContent = 'Add or remove a single user at a time.';

        // 🔹 Lista visible de miembros actuales
        const membersBox = document.createElement('div');
        membersBox.style.margin = '10px 0 15px 0';
        membersBox.style.maxHeight = '120px';
        membersBox.style.overflowY = 'auto';
        membersBox.style.fontSize = '14px';
        membersBox.style.padding = '8px';
        membersBox.style.background = '#f9fafb';
        membersBox.style.borderRadius = '6px';
        membersBox.style.border = '1px solid #e5e7eb';

        if (membersList.length === 0) {
            membersBox.textContent = 'No members yet.';
        } else {
            const ul = document.createElement('ul');
            ul.style.listStyle = 'none';
            ul.style.padding = '0';
            membersList.forEach(m => {
                const li = document.createElement('li');
                li.textContent = m;
                li.style.padding = '2px 0';
                ul.appendChild(li);
            });
            membersBox.appendChild(ul);
        }

        const addInput = document.createElement('input');
        addInput.classList.add('modal-input');
        addInput.placeholder = 'Username to add';

        const removeInput = document.createElement('input');
        removeInput.classList.add('modal-input');
        removeInput.placeholder = 'Username to remove';

        const buttons = document.createElement('div');
        buttons.classList.add('modal-buttons');

        const cancelBtn = document.createElement('button');
        cancelBtn.classList.add('modal-btn', 'modal-btn-cancel');
        cancelBtn.textContent = 'Close';
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        const addBtn = document.createElement('button');
        addBtn.classList.add('modal-btn', 'modal-btn-create');
        addBtn.textContent = 'Add';
        addBtn.addEventListener('click', async () => {
            const user = addInput.value.trim();
            if (!user) return;
            try {
                const res = await window.ChatService.addMemberToGroup(groupName, user);
                if (res.status === 'ok') {
                    showToast('success', `${user} added to ${groupName}`);
                } else {
                    showToast(res.message || 'error', `Could not add ${user}`);
                }
            } catch (e) {
                console.error(e);
                showToast('error', `Error adding ${user}`,);
            }
        });

        const removeBtn = document.createElement('button');
        removeBtn.classList.add('modal-btn', 'modal-btn-cancel');
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', async () => {
            const user = removeInput.value.trim();
            if (!user) return;
            try {
                const res = await window.ChatService.removeMemberFromGroup(groupName, user);
                if (res.status === 'ok') {
                    showToast('info', `${user} removed from ${groupName}`);
                } else {
                    showToast(res.message || 'error', `Could not remove ${user}`);
                }
            } catch (e) {
                console.error(e);
                showToast('error', `Error removing ${user}`);
            }
        });

        buttons.appendChild(addBtn);
        buttons.appendChild(removeBtn);
        buttons.appendChild(cancelBtn);

        content.appendChild(title);
        content.appendChild(info);
        content.appendChild(membersBox);
        content.appendChild(addInput);
        content.appendChild(removeInput);
        content.appendChild(buttons);

        overlay.appendChild(content);
        document.body.appendChild(overlay);
    }


    function updateMessagesContainer(newMessages) {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;

        messagesContainer.innerHTML = '';

        if (!newMessages || newMessages.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.classList.add('messages-empty');
            emptyMsg.textContent = 'No messages yet. Start the conversation!';
            messagesContainer.appendChild(emptyMsg);
            return;
        }

        newMessages.forEach(msg => {
            const wrapper = document.createElement('div');
            wrapper.classList.add('message-wrapper');
            wrapper.classList.add(msg.sender === username ? 'sent' : 'received');

            const message = document.createElement('div');
            message.classList.add('message');
            message.classList.add(msg.sender === username ? 'sent' : 'received');

            if (msg.sender !== username) {
                const sender = document.createElement('div');
                sender.classList.add('message-sender');
                sender.textContent = msg.sender;
                message.appendChild(sender);
            }

            const content = document.createElement('div');
            content.classList.add('message-content');

            const isAudio = msg.isAudio && msg.audioFile;
            const isCallStart = msg.isCallStart;
            const isCallEnd = msg.isCallEnd;

            if (isAudio) {
                // Audio guardado en historial
                window.ChatService.getAudioFromHistory(msg.audioFile)
                    .then(bytes => {
                        if (bytes && bytes.length > 0) {
                            const uint8 = new Uint8Array(bytes);
                            const blob = new Blob([uint8], { type: 'audio/webm' });
                            const player = createAudioPlayer(blob);
                            content.appendChild(player);
                        } else {
                            content.textContent = '[Audio not available]';
                        }
                    })
                    .catch(err => {
                        console.error('Error cargando audio de historial:', err);
                        content.textContent = '[Error loading audio]';
                    });
            } else if (isCallStart || isCallEnd) {
                const icon = document.createElement('span');
                icon.classList.add('message-call-icon');
                icon.textContent = '📞';

                const label = document.createElement('span');
                label.classList.add('message-call-label');
                label.textContent = isCallStart ? 'Call started' : 'Call ended';

                content.appendChild(icon);
                content.appendChild(label);
            } else {
                // 🔹 Parsear posible reply
                let raw = msg.content || '';
                let replyMeta = null;

                const replyRegex = /^\[REPLY:([^|]+)\|([^\]]+)\]\s*(.*)$/;
                const m = raw.match(replyRegex);
                if (m) {
                    replyMeta = { sender: m[1], timestamp: m[2] };
                    raw = m[3] || '';
                }

                if (replyMeta) {
                    const replyLine = document.createElement('div');
                    replyLine.style.fontSize = '0.75rem';
                    replyLine.style.opacity = '0.7';
                    replyLine.style.marginBottom = '2px';
                    replyLine.textContent =
                        `Replying to ${replyMeta.sender} (${replyMeta.timestamp})`;
                    content.appendChild(replyLine);
                }

                content.appendChild(document.createTextNode(raw));
            }

            const time = document.createElement('div');
            time.classList.add('message-time');
            time.textContent = msg.timestamp || '';

            message.appendChild(content);
            message.appendChild(time);

            // 🔹 Botón Reply solo para recibidos
            if (msg.sender !== username) {
                const replyBtn = document.createElement('button');
                replyBtn.textContent = 'Reply';
                replyBtn.classList.add('reply-btn');
                replyBtn.style.border = 'none';
                replyBtn.style.background = 'transparent';
                replyBtn.style.color = '#3b82f6';
                replyBtn.style.cursor = 'pointer';
                replyBtn.style.fontSize = '0.75rem';
                replyBtn.style.marginTop = '4px';
                replyBtn.style.alignSelf = 'flex-end';

                replyBtn.addEventListener('click', () => {
                    replyToMessage = {
                        sender: msg.sender,
                        content: isAudio ? '[Audio message]' : (msg.content || ''),
                        timestamp: msg.timestamp || ''
                    };
                    const rc = document.getElementById('replyContainer');
                    const rt = document.getElementById('replyText');
                    if (rc && rt) {
                        rt.textContent =
                            `Replying to ${replyToMessage.sender}: "${replyToMessage.content}"`;
                        rc.classList.remove('hidden');
                    }
                    const input = document.getElementById('messageInput');
                    if (input) input.focus();
                });

                message.appendChild(replyBtn);
            }

            wrapper.appendChild(message);
            messagesContainer.appendChild(wrapper);
        });

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }



    function createInputContainer() {
        const inputContainer = document.createElement('div');
        inputContainer.classList.add('input-container');

        const replyContainer = document.createElement('div');
        replyContainer.id = 'replyContainer';
        replyContainer.classList.add('error-message', 'hidden');
        replyContainer.style.background = '#e5f3ff';
        replyContainer.style.color = '#1d4ed8';
        replyContainer.style.marginBottom = '8px';
        replyContainer.style.display = 'flex';
        replyContainer.style.justifyContent = 'space-between';
        replyContainer.style.alignItems = 'center';

        const replyText = document.createElement('span');
        replyText.id = 'replyText';
        replyText.style.fontSize = '0.85rem';
        replyText.style.whiteSpace = 'nowrap';
        replyText.style.overflow = 'hidden';
        replyText.style.textOverflow = 'ellipsis';

        const cancelReplyBtn = document.createElement('button');
        cancelReplyBtn.textContent = '×';
        cancelReplyBtn.style.marginLeft = '8px';
        cancelReplyBtn.style.background = 'none';
        cancelReplyBtn.style.border = 'none';
        cancelReplyBtn.style.cursor = 'pointer';
        cancelReplyBtn.style.fontSize = '1rem';
        cancelReplyBtn.onclick = () => {
            replyToMessage = null;
            replyContainer.classList.add('hidden');
        };

        replyContainer.appendChild(replyText);
        replyContainer.appendChild(cancelReplyBtn);

        inputContainer.appendChild(replyContainer);

        const errorMessage = document.createElement('div');
        errorMessage.classList.add('error-message', 'hidden');
        errorMessage.id = 'errorMessage';

        const inputWrapper = document.createElement('div');
        inputWrapper.classList.add('input-wrapper');

        const messageInput = document.createElement('input');
        messageInput.type = 'text';
        messageInput.classList.add('message-input');
        messageInput.placeholder = 'Type a message...';
        messageInput.id = 'messageInput';

        const sendBtn = document.createElement('button');
        sendBtn.classList.add('send-btn');
        const sendIcon = document.createElement('span');
        sendIcon.classList.add('icon-send');
        sendBtn.appendChild(sendIcon);
        sendBtn.appendChild(document.createTextNode(' Send'));
        sendBtn.addEventListener('click', sendMessage);

        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        inputWrapper.appendChild(messageInput);
        inputWrapper.appendChild(sendBtn);
        inputContainer.appendChild(errorMessage);
        inputContainer.appendChild(inputWrapper);

        return inputContainer;
    }

    // ============================================
    // 6. Historial (vista)
    // ============================================
    function renderHistoryView() {
        const main = document.getElementById('mainChat');
        if (!main) return;

        main.innerHTML = '';

        const historyHeader = document.createElement('div');
        historyHeader.classList.add('history-header');

        const title = document.createElement('h2');
        title.classList.add('history-header-title');
        title.textContent = 'Chat History';

        const backBtn = document.createElement('button');
        backBtn.textContent = 'Back to Chat';
        backBtn.classList.add('back-btn');
        backBtn.addEventListener('click', async () => {
            currentView = 'chat';
            try {
                await refreshMessages();
            } catch (e) {
                console.error('Error refrescando al volver del historial:', e);
            }
            renderMainChat();
        });

        historyHeader.appendChild(title);
        historyHeader.appendChild(backBtn);

        const historyContainer = document.createElement('div');
        historyContainer.classList.add('history-container');

        if (historyData && historyData.length > 0) {
            historyData.forEach(async msg => {
                const msgDiv = document.createElement('div');
                msgDiv.classList.add('history-message');

                // Colores distintos para inicio/fin de llamada
                if (msg.isCallStart) {
                    msgDiv.classList.add('history-call-start');
                } else if (msg.isCallEnd) {
                    msgDiv.classList.add('history-call-end');
                }

                const senderSpan = document.createElement('div');
                senderSpan.classList.add('history-message-sender');
                senderSpan.textContent = msg.sender;

                const contentSpan = document.createElement('div');
                contentSpan.classList.add('history-message-content');

                if (msg.isAudio && msg.audioFile) {
                    // Audio desde historial
                    try {
                        const bytes = await window.ChatService.getAudioFromHistory(msg.audioFile);
                        if (bytes && bytes.length > 0) {
                            const uint8 = new Uint8Array(bytes);
                            const blob = new Blob([uint8], { type: 'audio/webm' });
                            const player = createAudioPlayer(blob);
                            contentSpan.appendChild(player);
                        } else {
                            contentSpan.textContent = '[Audio not available]';
                        }
                    } catch (e) {
                        console.error('Error cargando audio de historial:', e);
                        contentSpan.textContent = '[Error loading audio]';
                    }
                } else if (msg.isCallStart || msg.isCallEnd) {
                    // Icono + texto corto para llamadas
                    const icon = document.createElement('span');
                    icon.classList.add('history-call-icon');
                    icon.textContent = '📞';

                    const label = document.createElement('span');
                    if (msg.isCallStart) {
                        label.textContent = 'Call started';
                    } else {
                        label.textContent = 'Call ended';
                    }

                    contentSpan.appendChild(icon);
                    contentSpan.appendChild(label);
                } else {
                    contentSpan.textContent = msg.content;
                }

                const timeSpan = document.createElement('div');
                timeSpan.classList.add('history-message-time');
                timeSpan.textContent = msg.timestamp;

                msgDiv.appendChild(senderSpan);
                msgDiv.appendChild(contentSpan);
                msgDiv.appendChild(timeSpan);

                historyContainer.appendChild(msgDiv);
            });
        } else {
            const emptyMsg = document.createElement('p');
            emptyMsg.classList.add('history-empty');
            emptyMsg.textContent = 'No history available';
            historyContainer.appendChild(emptyMsg);
        }

        main.appendChild(historyHeader);
        main.appendChild(historyContainer);
    }


    // ============================================
    // 7. Acciones: enviar mensaje / historial / refresh
    // ============================================
    async function sendMessage() {
        const input = document.getElementById('messageInput');
        const errorDiv = document.getElementById('errorMessage');
        const message = input.value.trim();

        if (!message) return;

        const ok = await ensureIceConnection();
        if (!ok) {
            if (errorDiv) {
                errorDiv.textContent = 'Error: Not connected to chat server';
                errorDiv.classList.remove('hidden');
            }
            return;
        }

        if (!window.ChatService || !window.ChatService.chatServicePrx) {
            if (errorDiv) {
                errorDiv.textContent = 'Error: Not connected to chat server';
                errorDiv.classList.remove('hidden');
            }
            return;
        }

        try {
            if (errorDiv) errorDiv.classList.add('hidden');
            let response;
            let payload = message;

            if (replyToMessage) {
                payload =
                    `[REPLY:${replyToMessage.sender}|${replyToMessage.timestamp}] ` + message;
            }


            if (chatType === 'private') {
                const recipient =
                    typeof selectedChat === 'object' ? selectedChat.name : selectedChat;
                response = await window.ChatService.sendPrivateMessage(
                    recipient,
                    payload
                );
            } else {
                const groupName =
                    typeof selectedChat === 'object' ? selectedChat.name : selectedChat;
                response = await window.ChatService.sendGroupMessage(
                    groupName,
                    payload
                );
            }

            if (response && response.status === 'error') {
                throw new Error(response.error);
            }

            messages.push({
                sender: currentUser,
                content: payload,
                timestamp: new Date().toLocaleTimeString()
            });

            const chatKey = `${chatType}_${typeof selectedChat === 'object' ? selectedChat.name : selectedChat
                }`;
            messageCache[chatKey] = [...messages];

            replyToMessage = null;
            const rc = document.getElementById('replyContainer');
            if (rc) rc.classList.add('hidden');

            input.value = '';
            updateMessagesContainer(messages);
        } catch (err) {
            console.error('Error sending message:', err);
            if (errorDiv) {
                errorDiv.textContent = 'Failed to send message: ' + err.message;
                errorDiv.classList.remove('hidden');
            }
        }
    }

    async function loadHistory() {
        if (!selectedChat) return;

        try {
            const ok = await ensureIceConnection();
            if (!ok) return;

            const errorDiv = document.getElementById('errorMessage');
            if (errorDiv) errorDiv.classList.add('hidden');

            let history;

            if (chatType === 'private') {
                history = await window.ChatService.getPrivateHistory(
                    username,
                    selectedChat
                );
            } else {
                const groupName =
                    typeof selectedChat === 'object' ? selectedChat.name : selectedChat;
                history = await window.ChatService.getGroupHistory(groupName);
            }

            console.log('📜 Historial recibido:', history);

            // Normalizar historial detectando AUDIO y CALL
            historyData = (history || []).map(msg => {
                const sender = msg.sender || 'Unknown';
                const timestamp = msg.timestamp || '';
                const rawContent = msg.content || msg.message || '';

                let content = rawContent;
                let isAudio = false;
                let audioFile = null;
                let isCallStart = false;
                let isCallEnd = false;

                if (rawContent.startsWith('[AUDIO:')) {
                    const match = rawContent.match(/^\[AUDIO:(.+)\]$/);
                    if (match) {
                        isAudio = true;
                        audioFile = match[1].trim();
                        content = '';
                    }
                } else if (rawContent.startsWith('[CALL START]')) {
                    isCallStart = true;
                    content = rawContent; // el texto completo, por si quieres mostrar detalles
                } else if (rawContent.startsWith('[CALL END]')) {
                    isCallEnd = true;
                    content = rawContent;
                }

                return {
                    sender,
                    content,
                    timestamp,
                    isAudio,
                    audioFile,
                    isCallStart,
                    isCallEnd
                };
            });

            currentView = 'history';
            renderMainChat();
        } catch (err) {
            console.error('❌ Error loading history:', err);
            const errorDiv = document.getElementById('errorMessage');
            if (errorDiv) {
                errorDiv.textContent = 'Failed to load history: ' + err.message;
                errorDiv.classList.remove('hidden');
            }
        }
    }


    async function refreshMessages() {
        if (!selectedChat) return;

        try {
            const ok = await ensureIceConnection();
            if (!ok) return;

            let history;
            if (chatType === 'private') {
                history = await window.ChatService.getPrivateHistory(
                    currentUser || username,
                    selectedChat
                );
            } else {
                const groupName =
                    typeof selectedChat === 'object' ? selectedChat.name : selectedChat;
                history = await window.ChatService.getGroupHistory(groupName);
            }

            console.log('📥 Historial recibido (refresh):', history);

            if (!Array.isArray(history)) {
                console.warn('No se recibió un arreglo de historial');
                return;
            }

            const parsedMessages = history.map(msg => {
                const sender = msg.sender;
                const timestamp = msg.timestamp;
                const rawContent = msg.content;

                let content = rawContent;
                let isAudio = false;
                let audioFile = null;
                let isCallStart = false;
                let isCallEnd = false;

                if (rawContent && rawContent.startsWith('[AUDIO:')) {
                    const match = rawContent.match(/^\[AUDIO:(.+)\]$/);
                    if (match) {
                        isAudio = true;
                        audioFile = match[1].trim();
                        content = '';
                    }
                } else if (rawContent && rawContent.startsWith('[CALL START]')) {
                    isCallStart = true;
                } else if (rawContent && rawContent.startsWith('[CALL END]')) {
                    isCallEnd = true;
                }

                return {
                    sender,
                    content,
                    timestamp,
                    isAudio,
                    audioFile,
                    isCallStart,
                    isCallEnd
                };
            });

            const newData = JSON.stringify(parsedMessages);
            const oldData = JSON.stringify(messages);

            if (newData !== oldData) {
                messages = parsedMessages;
                const chatKey = `${chatType}_${typeof selectedChat === 'object' ? selectedChat.name : selectedChat
                    }`;
                messageCache[chatKey] = [...messages];
                updateMessagesContainer(messages);
            }
        } catch (err) {
            console.error('Error in refreshMessages:', err);
        }
    }


    // ============================================
    // 8. Logout y modales de grupos
    // ============================================
    function handleLogout() {
        sessionStorage.removeItem('username');
        document.getElementById('app').innerHTML = '';
        import('./Home.js').then(module => {
            document.getElementById('app').appendChild(module.Home());
        });
    }

    function showGroupModal() {
        const modal = document.createElement('div');
        modal.classList.add('modal-overlay', 'show');

        const modalContent = document.createElement('div');
        modalContent.classList.add('modal-content');

        const title = document.createElement('h3');
        title.textContent = 'Create New Group';

        const groupNameInput = document.createElement('input');
        groupNameInput.type = 'text';
        groupNameInput.classList.add('modal-input');
        groupNameInput.placeholder = 'Group name';

        const usersInput = document.createElement('input');
        usersInput.type = 'text';
        usersInput.classList.add('modal-input');
        usersInput.placeholder = 'Users (comma-separated)';

        const errorMsg = document.createElement('div');
        errorMsg.classList.add('error-message', 'hidden');

        const buttonContainer = document.createElement('div');
        buttonContainer.classList.add('modal-buttons');

        const cancelBtn = document.createElement('button');
        cancelBtn.classList.add('modal-btn', 'modal-btn-cancel');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', async () => {
            await window.ChatService.endCall(callId);
        });

        const createBtn = document.createElement('button');
        createBtn.classList.add('modal-btn', 'modal-btn-create');
        createBtn.textContent = 'Create';
        createBtn.addEventListener('click', async () => {
            const groupName = groupNameInput.value.trim();
            const usersStr = usersInput.value.trim();

            if (!groupName || !usersStr) {
                errorMsg.textContent = 'Please fill all fields';
                errorMsg.classList.remove('hidden');
                return;
            }

            try {
                const response = await window.ChatService.createGroup(
                    groupName,
                    usersStr
                );

                if (response.status === 'ok') {
                    // groups.push({
                    //     name: groupName,
                    //     members: response.members || []
                    // });
                    // renderGroupsList();
                    document.body.removeChild(modal);

                    if (response.invalidUsers && response.invalidUsers.length > 0) {
                        alert(
                            'Group created, but some users were invalid: ' +
                            response.invalidUsers.join(', ')
                        );
                    }
                } else {
                    throw new Error(response.message || 'Failed to create group');
                }
            } catch (err) {
                errorMsg.textContent = err.message;
                errorMsg.classList.remove('hidden');
            }
        });

        buttonContainer.appendChild(cancelBtn);
        buttonContainer.appendChild(createBtn);

        modalContent.appendChild(title);
        modalContent.appendChild(groupNameInput);
        modalContent.appendChild(usersInput);
        modalContent.appendChild(errorMsg);
        modalContent.appendChild(buttonContainer);

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });

        setTimeout(() => groupNameInput.focus(), 100);
    }

    function showDeleteGroupModal() {
        if (!groups || groups.length === 0) {
            alert('There are no groups to delete.');
            return;
        }

        const modal = document.createElement('div');
        modal.classList.add('modal-overlay', 'show');

        const modalContent = document.createElement('div');
        modalContent.classList.add('modal-content');

        const title = document.createElement('h3');
        title.textContent = 'Delete Group';

        const selectLabel = document.createElement('label');
        selectLabel.textContent = 'Select a group:';

        const groupSelect = document.createElement('select');
        groupSelect.classList.add('modal-input');

        groups.forEach(g => {
            const name = typeof g === 'string' ? g : g.name;
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            groupSelect.appendChild(opt);
        });

        const errorMsg = document.createElement('div');
        errorMsg.classList.add('error-message', 'hidden');

        const buttonContainer = document.createElement('div');
        buttonContainer.classList.add('modal-buttons');

        const cancelBtn = document.createElement('button');
        cancelBtn.classList.add('modal-btn', 'modal-btn-cancel');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('modal-btn', 'modal-btn-delete');
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', async () => {
            const groupName = groupSelect.value;
            if (!groupName) {
                errorMsg.textContent = 'Select a group';
                errorMsg.classList.remove('hidden');
                return;
            }

            try {
                deleteBtn.disabled = true;
                deleteBtn.textContent = 'Deleting...';

                const resp = await window.ChatService.deleteGroup(groupName);
                if (resp.status !== 'ok') {
                    throw new Error(resp.message || 'Error deleting group');
                }

                groups = groups.filter(
                    g => (typeof g === 'string' ? g : g.name) !== groupName
                );

                if (selectedChat === groupName && chatType === 'group') {
                    selectedChat = null;
                    chatType = null;
                    messages = [];
                    renderMainChat();
                }

                renderGroupsList();
                document.body.removeChild(modal);
                alert(`Group '${groupName}' deleted`);
            } catch (err) {
                errorMsg.textContent = err.message;
                errorMsg.classList.remove('hidden');
            } finally {
                deleteBtn.disabled = false;
                deleteBtn.textContent = 'Delete';
            }
        });

        buttonContainer.appendChild(cancelBtn);
        buttonContainer.appendChild(deleteBtn);

        modalContent.appendChild(title);
        modalContent.appendChild(selectLabel);
        modalContent.appendChild(groupSelect);
        modalContent.appendChild(errorMsg);
        modalContent.appendChild(buttonContainer);

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) document.body.removeChild(modal);
        });
    }

    // ============================================
    // 9. Notas de voz
    // ============================================
    async function startVoiceRecording() {
        console.log('🎤 Iniciando grabación de voz...');

        if (isRecording) {
            stopVoiceRecording();
            return;
        }

        try {
            const ok = await ensureIceConnection();
            if (!ok) return;

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('✅ Acceso al micrófono concedido');

            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.addEventListener('dataavailable', event => {
                audioChunks.push(event.data);
            });

            mediaRecorder.addEventListener('stop', async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await sendVoiceNote(audioBlob);

                stream.getTracks().forEach(track => track.stop());
            });

            mediaRecorder.start();
            isRecording = true;

            const voiceBtn = document.querySelector('.voice-btn');
            if (voiceBtn) {
                voiceBtn.textContent = '⏹️';
                voiceBtn.style.background = '#e11d48';
                voiceBtn.title = 'Stop Recording';
            }
        } catch (error) {
            console.error('❌ Error al acceder al micrófono:', error);
            let errorMessage = 'No se pudo acceder al micrófono. ';
            if (error.name === 'NotAllowedError') {
                errorMessage += 'Debes permitir el acceso al micrófono.';
            } else if (error.name === 'NotFoundError') {
                errorMessage += 'No se encontró ningún micrófono.';
            } else if (error.name === 'NotReadableError') {
                errorMessage += 'El micrófono está siendo usado por otra aplicación.';
            } else {
                errorMessage += error.message;
            }
            alert(errorMessage);
        }
    }

    function stopVoiceRecording() {
        console.log('⏹️ Deteniendo grabación...');

        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            isRecording = false;

            const voiceBtn = document.querySelector('.voice-btn');
            if (voiceBtn) {
                voiceBtn.textContent = '🎤';
                voiceBtn.style.background = '';
                voiceBtn.title = 'Send Voice Note';
            }
        } else {
            console.warn('⚠️ No hay grabación activa para detener');
        }
    }

    async function sendVoiceNote(audioBlob) {
        console.log('ENVIANDO NOTA DE VOZ');
        console.log('   Tamaño del blob:', audioBlob.size, 'bytes');
        console.log('   Tipo:', audioBlob.type);
        console.log('   Destinatario:', selectedChat);
        console.log('   Tipo de chat:', chatType);

        if (!selectedChat) {
            alert('Please select a chat first');
            return;
        }

        try {
            const ok = await ensureIceConnection();
            if (!ok) return;

            let success = false;

            if (chatType === 'private') {
                success = await window.ChatService.sendVoiceNote(selectedChat, audioBlob);
            } else if (chatType === 'group') {
                const groupName = typeof selectedChat === 'object' ? selectedChat.name : selectedChat;
                success = await window.ChatService.sendGroupVoiceNote(groupName, audioBlob);
            }

            if (success) {
                console.log('✅ Nota de voz enviada, pintando localmente. Tipo:', chatType);

                let messagesContainer = document.getElementById('messagesContainer');
                if (!messagesContainer) {
                    console.warn('⚠️ messagesContainer no existe, re-renderizando chat');
                    renderMainChat();
                    messagesContainer = document.getElementById('messagesContainer');
                }
                if (!messagesContainer) {
                    console.error('❌ No se pudo obtener messagesContainer');
                    return;
                }

                const wrapper = document.createElement('div');
                wrapper.classList.add('message-wrapper', 'sent');

                const audioMessage = document.createElement('div');
                audioMessage.classList.add('message', 'sent', 'audio-message');

                const audioPlayer = createAudioPlayer(audioBlob);
                const time = document.createElement('div');
                time.classList.add('message-time');
                time.textContent = new Date().toLocaleTimeString();

                audioMessage.appendChild(audioPlayer);
                audioMessage.appendChild(time);
                wrapper.appendChild(audioMessage);
                messagesContainer.appendChild(wrapper);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;

                // Opcional: actualizar array messages para refrescos / historial en RAM
                messages.push({
                    sender: currentUser,
                    content: '[AUDIO]',
                    timestamp: time.textContent,
                    isAudio: true,
                    isGroup: chatType === 'group'
                });
            } else {
                throw new Error('El servidor retornó false');
            }
        } catch (error) {
            console.error('Error enviando nota de voz:', error);
            alert('Error al enviar nota de voz: ' + error.message);
        }
    }


    // ============================================
    // 10. Llamadas de audio
    // ============================================

    async function startCallAudioStreaming(callId) {
        console.log('🎙️ Iniciando streaming de audio para llamada:', callId);

        if (callMediaRecorder) {
            console.warn('⚠️ Ya hay un streaming de llamada activo');
            return;
        }

        try {
            const ok = await ensureIceConnection();
            if (!ok) return;

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('✅ Micrófono para llamada concedido');

            callStream = stream;

            const recorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            callMediaRecorder = recorder;

            recorder.addEventListener('dataavailable', async (event) => {
                if (!event.data || event.data.size === 0) return;

                try {
                    const buffer = await event.data.arrayBuffer();
                    const uint8 = new Uint8Array(buffer);

                    await window.ChatService.streamCallAudio(callId, uint8);
                } catch (e) {
                    console.error('❌ Error enviando chunk de llamada:', e);
                }
            });

            recorder.addEventListener('stop', () => {
                console.log('⏹️ Streaming de llamada detenido');
            });

            // Generar chunks cada 300–500 ms
            recorder.start(400);
            console.log('▶️ Streaming de llamada iniciado');

        } catch (error) {
            console.error('❌ Error iniciando streaming de llamada:', error);
            alert('No se pudo iniciar el audio de la llamada: ' + error.message);
        }
    }

    function stopCallAudioStreaming() {
        console.log('🔚 Deteniendo streaming de llamada');

        if (callMediaRecorder) {
            try {
                if (callMediaRecorder.state !== 'inactive') {
                    callMediaRecorder.stop();
                }
            } catch (e) {
                console.warn('⚠️ Error al parar MediaRecorder de llamada:', e);
            }
            callMediaRecorder = null;
        }

        if (callStream) {
            callStream.getTracks().forEach(track => track.stop());
            callStream = null;
        }

    }

    async function initiateCall(callee) {
        console.log('📞 INICIANDO LLAMADA con:', callee);

        try {
            const ok = await ensureIceConnection();
            if (!ok) return;

            const callId = await window.ChatService.initiateCall(callee);
            console.log('callId recibido:', callId);

            if (callId) {
                callStates[callId] = 'ringing';
                showOutgoingCallUI(callId, callee);
            } else {
                throw new Error('El servidor no retornó un callId válido');
            }
        } catch (error) {
            console.error('❌ Error iniciando llamada:', error);
            alert('Error al iniciar llamada: ' + error.message);
        }
    }

    async function startCallPcmStreaming(callId) {
        console.log('🎙️ Iniciando streaming PCM para llamada:', callId);

        if (callAudioContext) {
            console.warn('⚠️ Ya hay streaming de llamada activo');
            return;
        }

        const ok = await ensureIceConnection();
        if (!ok) return;

        callAudioContext = new AudioContext({ sampleRate: 48000 });

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        callMicStream = stream;

        callSourceNode = callAudioContext.createMediaStreamSource(stream);
        callProcessorNode = callAudioContext.createScriptProcessor(8192, 1, 1);

        callProcessorNode.onaudioprocess = async (event) => {
            const input = event.inputBuffer.getChannelData(0); // Float32
            const pcm16 = float32ToPcm16(input);              // Uint8Array

            try {
                await window.ChatService.streamCallAudio(callId, pcm16);
            } catch (e) {
                console.error('❌ Error enviando chunk PCM de llamada:', e);
            }
        };

        callSourceNode.connect(callProcessorNode);
        // Si no quieres oírte a ti mismo, conecta a un GainNode en 0; si no, al destino:
        // callProcessorNode.connect(callAudioContext.destination);
        callProcessorNode.connect(callAudioContext.destination);

        console.log('▶️ Streaming PCM de llamada iniciado');
    }

    function stopCallPcmStreaming() {
        console.log('🔚 Deteniendo streaming PCM de llamada');

        if (callProcessorNode) {
            callProcessorNode.disconnect();
            callProcessorNode = null;
        }
        if (callSourceNode) {
            callSourceNode.disconnect();
            callSourceNode = null;
        }
        if (callMicStream) {
            callMicStream.getTracks().forEach(t => t.stop());
            callMicStream = null;
        }
        if (callAudioContext) {
            callAudioContext.close();
            callAudioContext = null;
        }

    }


    function showOutgoingCallUI(callId, callee) {
        console.log('📞 Mostrando UI de llamada saliente');

        const existingUI = document.getElementById('outgoingCallUI');
        if (existingUI) {
            document.body.removeChild(existingUI);
        }

        const callUI = document.createElement('div');
        callUI.id = 'outgoingCallUI';
        callUI.classList.add('call-modal');

        const title = document.createElement('h3');
        title.textContent = '📞 Calling...';

        const calleeLabel = document.createElement('p');
        calleeLabel.classList.add('caller-name');
        calleeLabel.textContent = callee;

        const status = document.createElement('p');
        status.textContent = 'Waiting for response';

        const actions = document.createElement('div');
        actions.classList.add('call-actions');

        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancelCallBtn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.classList.add('modal-btn', 'modal-btn-cancel');

        cancelBtn.addEventListener('click', async () => {
            await window.ChatService.endCall(callId);
            document.body.removeChild(callUI);
        });

        actions.appendChild(cancelBtn);
        callUI.appendChild(title);
        callUI.appendChild(calleeLabel);
        callUI.appendChild(status);
        callUI.appendChild(actions);

        document.body.appendChild(callUI);
    }

    function startCallUI(callId) {
        const existing = document.getElementById('activeCallUI');
        if (existing) {
            document.body.removeChild(existing);
        }

        const callUI = document.createElement('div');
        callUI.id = 'activeCallUI';

        const text = document.createElement('p');
        text.style.margin = '0 0 15px 0';
        text.textContent = '📞 Call in progress...';

        const endBtn = document.createElement('button');
        endBtn.id = 'endCallBtn';
        endBtn.textContent = 'End Call';
        endBtn.style.background = '#e11d48';
        endBtn.style.color = 'white';
        endBtn.style.border = 'none';
        endBtn.style.padding = '10px 20px';
        endBtn.style.borderRadius = '8px';
        endBtn.style.cursor = 'pointer';

        endBtn.addEventListener('click', async () => {
            await window.ChatService.endCall(callId);
            endCallUI();
            stopCallPcmStreaming();
        });


        callUI.appendChild(text);
        callUI.appendChild(endBtn);
        document.body.appendChild(callUI);
    }

    function endCallUI() {
        const callUI = document.getElementById('activeCallUI');
        if (callUI) document.body.removeChild(callUI);

        const outUI = document.getElementById('outgoingCallUI');
        if (outUI) document.body.removeChild(outUI);
    }

    // ============================================
    // 11. Utilidades de audio y notificaciones
    // ============================================
    function formatAudioDuration(seconds) {
        if (!seconds || isNaN(seconds) || seconds === Infinity) {
            return '0:00';
        }

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function appendCallLogMessage(text) {
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        messages.push({
            sender: currentUser,
            content: text,
            timestamp: now,
            isCallStart: text.startsWith('[CALL START]'),
            isCallEnd: text.startsWith('[CALL END]'),
            isCallRejected: text.startsWith('[CALL REJECTED]'),
            isCallCanceled: text.startsWith('[CALL CANCELED]')

        });
        updateMessagesContainer(messages);
    }


    function createAudioPlayer(audioBlob) {
        console.log('🎧 Creando reproductor de audio');
        console.log('   Blob size:', audioBlob.size);
        console.log('   Blob type:', audioBlob.type);

        const audioPlayer = document.createElement('div');
        audioPlayer.classList.add('audio-player');

        const audio = new Audio(URL.createObjectURL(audioBlob));

        const playBtn = document.createElement('button');
        playBtn.classList.add('audio-play-btn');
        playBtn.innerHTML = '▶️';

        const progressBar = document.createElement('div');
        progressBar.classList.add('audio-progress-bar');

        const progress = document.createElement('div');
        progress.classList.add('audio-progress');
        progressBar.appendChild(progress);

        const durationLabel = document.createElement('span');
        durationLabel.classList.add('audio-duration');
        durationLabel.textContent = '0:00';

        let isPlaying = false;
        let duration = 0;

        function ensureValidDuration() {
            if (!duration || !isFinite(duration) || isNaN(duration)) {
                duration = audio.duration;
            }
        }

        audio.addEventListener('loadedmetadata', () => {
            ensureValidDuration();
            console.log('   loadedmetadata, duration:', audio.duration);
            if (duration && isFinite(duration) && !isNaN(duration)) {
                durationLabel.textContent = formatAudioDuration(duration);
            }
        });

        audio.addEventListener('timeupdate', () => {
            ensureValidDuration();
            if (duration && duration > 0 && isFinite(duration)) {
                const percentage = (audio.currentTime / duration) * 100;
                progress.style.width = percentage + '%';
                durationLabel.textContent = formatAudioDuration(
                    duration - audio.currentTime
                );
            }
        });

        audio.addEventListener('ended', () => {
            console.log('   Reproducción terminada');
            isPlaying = false;
            playBtn.innerHTML = '▶️';
            progress.style.width = '0%';
            if (duration && isFinite(duration)) {
                durationLabel.textContent = formatAudioDuration(duration);
            } else {
                durationLabel.textContent = '0:00';
            }
        });

        audio.addEventListener('error', (e) => {
            console.error('❌ Error al reproducir audio:', e);
            playBtn.innerHTML = '❌';
            playBtn.disabled = true;
            durationLabel.textContent = 'Error';
        });

        playBtn.addEventListener('click', () => {
            if (isPlaying) {
                audio.pause();
                playBtn.innerHTML = '▶️';
                isPlaying = false;
            } else {
                audio.play().then(() => {
                    ensureValidDuration();
                    if (duration && isFinite(duration) && !isNaN(duration)) {
                        durationLabel.textContent = formatAudioDuration(duration);
                    }
                    playBtn.innerHTML = '⏸️';
                    isPlaying = true;
                }).catch(err => {
                    console.error('❌ Error al reproducir audio:', err);
                    alert('Error al reproducir audio');
                });
            }
        });

        progressBar.addEventListener('click', (e) => {
            ensureValidDuration();
            if (duration && duration > 0 && isFinite(duration)) {
                const rect = progressBar.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const percentage = clickX / rect.width;
                audio.currentTime = percentage * duration;
            }
        });

        audioPlayer.appendChild(playBtn);
        audioPlayer.appendChild(progressBar);
        audioPlayer.appendChild(durationLabel);

        return audioPlayer;
    }

    function float32ToPcm16(float32Array) {
        const len = float32Array.length;
        const buffer = new ArrayBuffer(len * 2);
        const view = new DataView(buffer);

        for (let i = 0; i < len; i++) {
            let sample = float32Array[i];
            if (sample > 1) sample = 1;
            if (sample < -1) sample = -1;
            view.setInt16(i * 2, sample * 0x7fff, false); // big endian
        }

        return new Uint8Array(buffer);
    }

    function pcm16ToFloat32(arrayBuffer, littleEndian = false) {
        const buffer = arrayBuffer instanceof ArrayBuffer ? arrayBuffer : arrayBuffer.buffer;
        const view = new DataView(buffer);
        const float32Array = new Float32Array(buffer.byteLength / 2);

        for (let i = 0; i < float32Array.length; i++) {
            const sample = view.getInt16(i * 2, littleEndian);
            float32Array[i] = sample / 32768;
        }
        return float32Array;
    }

    function initCallPlayback() {
        if (!callPlaybackContext) {
            callPlaybackContext = new AudioContext({ sampleRate: 48000 });
        }
    }

    function enqueueCallPcmChunk(uint8Array) {
        initCallPlayback();

        const floatData = pcm16ToFloat32(uint8Array.buffer, false);
        const MAX_QUEUE = 3;
        if (callPlaybackQueue.length >= MAX_QUEUE) {
            // descarta lo más viejo, conserva solo los últimos 2
            callPlaybackQueue = callPlaybackQueue.slice(- (MAX_QUEUE - 1));
        }
        callPlaybackQueue.push(floatData);

        if (!callPlaybackPlaying) {
            processCallPlaybackQueue();
        }
    }

    function processCallPlaybackQueue() {
        if (!callPlaybackContext) return;

        if (callPlaybackQueue.length === 0) {
            callPlaybackPlaying = false;
            return;
        }

        callPlaybackPlaying = true;

        const floatArray = callPlaybackQueue.shift();
        const audioBuffer = callPlaybackContext.createBuffer(1, floatArray.length, 48000);
        audioBuffer.getChannelData(0).set(floatArray);

        const source = callPlaybackContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(callPlaybackContext.destination);
        source.start();

        source.onended = processCallPlaybackQueue;
    }

    function showNewMessageNotification(data) {
        const isGroup = data.type === 'group';
        const chatItem = isGroup
            ? document.querySelector(`[data-group="${data.groupName}"]`)
            : document.querySelector(`[data-user="${data.sender}"]`);

        if (!chatItem) return;

        let badge = chatItem.querySelector('.notification-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.classList.add('notification-badge');
            badge.textContent = '1';
            chatItem.appendChild(badge);
        } else {
            const count = parseInt(badge.textContent, 10) || 0;
            badge.textContent = String(count + 1);
        }
    }

    function showToast(type, message) {
        const toast = document.createElement('div');
        toast.classList.add('toast');

        if (type === 'success') toast.classList.add('toast-success');
        else if (type === 'error') toast.classList.add('toast-error');
        else toast.classList.add('toast-info');

        toast.textContent = message;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 250);
        }, 3000);
    }

    // ============================================
    // 12. Handlers de callbacks ICE -> UI
    // ============================================
    container.handleIncomingMessage = function (data) {
        console.log('📨 Mensaje entrante via Ice callback:', data);

        try {
            const isForCurrentPrivateChat =
                data.type === 'private' &&
                data.sender === selectedChat &&
                chatType === 'private';

            const isForCurrentGroupChat =
                data.type === 'group' &&
                data.groupName === selectedChat &&
                chatType === 'group';

            if (isForCurrentPrivateChat || isForCurrentGroupChat) {
                const newMessage = {
                    sender: data.sender,
                    content: data.content || data.message,
                    timestamp: data.timestamp || new Date().toLocaleTimeString()
                };

                messages.push(newMessage);

                const chatKey = `${chatType}_${selectedChat}`;
                messageCache[chatKey] = [...messages];

                updateMessagesContainer(messages);
            } else {
                showNewMessageNotification(data);
            }
        } catch (error) {
            console.error('Error manejando mensaje entrante:', error);
        }
    };

    container.handleIncomingVoiceNote = function (data) {
        console.log('🎤 Nota de voz recibida via Ice:', data);
        try {
            const isPrivate =
                data.type === 'private' &&
                chatType === 'private' &&
                data.sender === selectedChat;

            const isGroup =
                data.type === 'group' &&
                chatType === 'group' &&
                data.groupName === (typeof selectedChat === 'object'
                    ? selectedChat.name
                    : selectedChat);

            const isForCurrentChat = isPrivate || isGroup;

            if (isForCurrentChat) {
                const messagesContainer = document.getElementById('messagesContainer');
                if (!messagesContainer) return;

                const wrapper = document.createElement('div');
                wrapper.classList.add('message-wrapper', 'received');

                const audioMessage = document.createElement('div');
                audioMessage.classList.add('message', 'received', 'audio-message');

                if (data.type === 'group') {
                    const senderLabel = document.createElement('div');
                    senderLabel.classList.add('message-sender');
                    senderLabel.textContent = data.sender;
                    audioMessage.appendChild(senderLabel);
                }

                const audioPlayer = createAudioPlayer(data.audioBlob);

                const time = document.createElement('div');
                time.classList.add('message-time');
                time.textContent = data.timestamp;

                audioMessage.appendChild(audioPlayer);
                audioMessage.appendChild(time);
                wrapper.appendChild(audioMessage);
                messagesContainer.appendChild(wrapper);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else {
                showNewMessageNotification({
                    type: 'voice',
                    sender: data.sender,
                    timestamp: data.timestamp
                });
            }
        } catch (error) {
            console.error('Error manejando nota de voz:', error);
        }
    };


    container.handleCallEvent = function (data) {
        console.log('📞 Evento de llamada:', data);

        try {
            if (data.type === 'incoming') {
                // Llamada entrante: estado "ringing"
                if (data.callInfo && data.callInfo.callId) {
                    callStates[data.callInfo.callId] = 'ringing';
                }
                showIncomingCallModal(data.callInfo);

            } else if (data.type === 'answered') {
                if (data.accepted) {
                    console.log('✅ Llamada aceptada, iniciando UI y streaming');

                    // Marcar como activa
                    callStates[data.callId] = 'active';

                    // Cerrar modal de llamada saliente si soy el caller
                    const outModal = document.getElementById('outgoingCallUI');
                    if (outModal && outModal.parentNode) {
                        outModal.parentNode.removeChild(outModal);
                    }

                    // Mostrar UI de llamada y empezar audio
                    startCallUI(data.callId);
                    startCallPcmStreaming(data.callId);

                    // Registrar inicio de llamada en el chat
                    appendCallLogMessage('[CALL START]');
                } else {
                    console.log('📞 Llamada rechazada');

                    // Registrar rechazo
                    appendCallLogMessage('[CALL REJECTED]');

                    endCallUI();
                    stopCallPcmStreaming();
                    delete callStates[data.callId];
                }

            } else if (data.type === 'audioChunk') {
                // data.chunk viene del ChatObserver como Uint8Array
                enqueueCallPcmChunk(data.chunk);

            } else if (data.type === 'ended') {
                console.log('📞 Llamada terminada (evento ended)');

                const state = callStates[data.callId];

                if (state === 'active') {
                    // Llamada estuvo activa → fin normal
                    appendCallLogMessage('[CALL END]');
                } else if (state === 'ringing') {
                    // Nunca se aceptó → alguien canceló antes
                    appendCallLogMessage('[CALL CANCELED]');
                } else {
                    // Sin estado conocido, puedes decidir no loguear nada
                    console.warn('Estado de llamada desconocido al terminar:', data.callId);
                }

                // Cerrar cualquier UI de llamada que quede
                const outModal = document.getElementById('outgoingCallUI');
                if (outModal && outModal.parentNode) {
                    outModal.parentNode.removeChild(outModal);
                }
                const active = document.getElementById('activeCallUI');
                if (active && active.parentNode) {
                    active.parentNode.removeChild(active);
                }

                endCallUI();
                stopCallPcmStreaming();
                delete callStates[data.callId];
            }
        } catch (error) {
            console.error('Error manejando evento de llamada:', error);
        }
    };



    container.handleUserStatusChange = function (data) {
        console.log('👤 Estado de usuario cambió:', data);

        try {
            if (data.online) {
                if (!users.includes(data.username) && data.username !== currentUser) {
                    users.push(data.username);
                    renderUsersList();
                    showToast('success', `${data.username} is now online`);
                }
            } else {
                const initialLength = users.length;
                users = users.filter(u => u !== data.username);

                if (users.length < initialLength) {
                    renderUsersList();
                    showToast('info', `${data.username} went offline`);

                    if (selectedChat === data.username && chatType === 'private') {
                        selectedChat = null;
                        chatType = null;
                        messages = [];
                        renderMainChat();
                    }
                }
            }
        } catch (error) {
            console.error('Error manejando cambio de estado:', error);
        }
    };

    container.handleGroupUpdate = function (data) {
        console.log('📁 Actualización de grupo:', data);

        try {
            if (data.type === 'created') {
                const isMember = Array.isArray(data.members) &&
                    data.members.includes(currentUser);
                if (!isMember) {
                    // Si ya no soy miembro, quitarlo de mi lista
                    groups = groups.filter(g => {
                        const name = typeof g === 'string' ? g : g.name;
                        return name !== data.groupName;
                    });
                    renderGroupsList();
                    return;
                }

                const idx = groups.findIndex(g => {
                    const name = typeof g === 'string' ? g : g.name;
                    return name === data.groupName;
                });

                if (idx >= 0) {
                    //actualizar miembros existentes
                    groups[idx] = {
                        name: data.groupName,
                        members: data.members || []
                    };
                } else {
                    //nuevo grupo
                    groups.push({
                        name: data.groupName,
                        members: data.members || []
                    });
                }

                renderGroupsList();
            } else if (data.type === 'deleted') {
                const groupName = data.groupName;
                groups = groups.filter(g => {
                    const name = typeof g === 'string' ? g : g.name;
                    return name !== groupName;
                });

                if (chatType === 'group' &&
                    ((typeof selectedChat === 'object' ? selectedChat.name : selectedChat) === groupName)) {
                    selectedChat = null;
                    chatType = null;
                    messages = [];
                    renderMainChat();
                }

                renderGroupsList();
            }
        } catch (e) {
            console.error('Error en handleGroupUpdate:', e);
        }
    };



    function showIncomingCallModal(callInfo) {
        const existing = document.getElementById('callModal');
        if (existing) document.body.removeChild(existing);

        const modal = document.createElement('div');
        modal.classList.add('modal-overlay', 'show');
        modal.id = 'callModal';

        const modalContent = document.createElement('div');
        modalContent.classList.add('modal-content', 'call-modal');

        const title = document.createElement('h2');
        title.textContent = 'Incoming Call';

        const caller = document.createElement('p');
        caller.classList.add('caller-name');
        caller.textContent = callInfo.caller;

        const actions = document.createElement('div');
        actions.classList.add('call-actions');

        const acceptBtn = document.createElement('button');
        acceptBtn.classList.add('accept-call-btn');
        acceptBtn.textContent = 'Accept';

        const rejectBtn = document.createElement('button');
        rejectBtn.classList.add('reject-call-btn');
        rejectBtn.textContent = 'Reject';

        actions.appendChild(acceptBtn);
        actions.appendChild(rejectBtn);
        modalContent.appendChild(title);
        modalContent.appendChild(caller);
        modalContent.appendChild(actions);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        acceptBtn.addEventListener('click', async () => {
            await window.ChatService.answerCall(callInfo.callId, true);
            document.body.removeChild(modal);
            startCallUI(callInfo.callId);
            startCallPcmStreaming(callInfo.callId);
        });


        rejectBtn.addEventListener('click', async () => {
            await window.ChatService.answerCall(callInfo.callId, false);
            document.body.removeChild(modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    const sidebar = createSidebar();
    container.appendChild(sidebar);
    container.appendChild(mainChat);

    renderUsersList();
    renderGroupsList();
    renderMainChat();

    container.loadInitialData = loadInitialData;

    return container;
}
