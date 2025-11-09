import { ChatService } from '../services/chatService.js';

export default function ChatApp(username) {
    const container = document.createElement('div');
    container.classList.add('chat-container');

    // State
    let selectedChat = null;
    let chatType = null;
    let currentUser = username;
    let messages = [];
    let users = []; // Simulated users
    let groups = [];
    let currentView = 'chat';
    let historyData = [];
    let messageCache = {};

    // Referencias a elementos del DOM
    let usersListElement = null;
    let groupsListElement = null;

    async function loadInitialData() {
        try {
            console.log('Loading initial data...');

            // Registrar usuario
            try {
                await ChatService.registerUser(username);
            } catch (err) {
                console.error('Error registering user:', err);
            }

            // Cargar usuarios
            try {
                const usersData = await ChatService.getConnectedUsers();
                console.log('Users received:', usersData);
                users = Array.isArray(usersData) ? usersData.filter(u => u !== username) : [];
            } catch (err) {
                console.error('Error loading users:', err);
                users = ['user1', 'user2', 'user3'].filter(u => u !== username);
            }

            // Cargar grupos
            try {
                const groupsData = await ChatService.getAllGroups();
                console.log('Groups received:', groupsData);

                if (Array.isArray(groupsData)) {
                    groups = groupsData.map(g => ({
                        name: typeof g === 'string' ? g : g.name,
                        members: typeof g === 'object' && g.members ? g.members : []
                    }));
                } else {
                    groups = [];
                }
            } catch (err) {
                console.error('Error loading groups:', err);
                groups = [];
            }

            renderUsersList();
            renderGroupsList();

            console.log('Initial data loaded:', { users, groups });
        } catch (err) {
            console.error('Error loading initial data:', err);
            users = [].filter(u => u !== username);
            groups = [];
            renderUsersList();
            renderGroupsList();
        }
    }


    // ============ SIDEBAR CREATION ============
    function createSidebar() {
        const sidebar = document.createElement('div');
        sidebar.classList.add('sidebar');

        // Sidebar Header
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
        logoutBtn.innerHTML = '<span class="icon-logout"></span> Logout';
        logoutBtn.addEventListener('click', handleLogout);

        userInfo.appendChild(userInfoText);
        userInfo.appendChild(logoutBtn);
        sidebarHeader.appendChild(userInfo);

        // Create Group Section
        const createGroupSection = document.createElement('div');
        createGroupSection.classList.add('create-group-section');

        const createGroupBtn = document.createElement('button');
        createGroupBtn.classList.add('create-group-btn');
        createGroupBtn.innerHTML = '<span class="icon-group"></span> Create Group';
        createGroupBtn.addEventListener('click', showGroupModal);

        createGroupSection.appendChild(createGroupBtn);

        // Chat Lists
        const chatListSection = document.createElement('div');
        chatListSection.classList.add('chat-list-section');

        const usersHeader = document.createElement('div');
        usersHeader.classList.add('chat-list-header');
        usersHeader.textContent = 'USERS';

        const usersList = document.createElement('div');
        usersList.id = 'usersList';
        usersListElement = usersList; // Guardar referencia

        const groupsHeader = document.createElement('div');
        groupsHeader.classList.add('chat-list-header');
        groupsHeader.textContent = 'GROUPS';
        groupsHeader.style.marginTop = '20px';

        const groupsList = document.createElement('div');
        groupsList.id = 'groupsList';
        groupsListElement = groupsList; // Guardar referencia

        chatListSection.appendChild(usersHeader);
        chatListSection.appendChild(usersList);
        chatListSection.appendChild(groupsHeader);
        chatListSection.appendChild(groupsList);

        sidebar.appendChild(sidebarHeader);
        sidebar.appendChild(createGroupSection);
        sidebar.appendChild(chatListSection);

        return sidebar;
    }



    // Main Chat Area
    const mainChat = document.createElement('div');
    mainChat.classList.add('main-chat');
    mainChat.id = 'mainChat';

    // Create sidebar
    const sidebar = createSidebar();

    container.appendChild(sidebar);
    container.appendChild(mainChat);

    loadInitialData();

    // Initial render DESPUÉS de crear los elementos
    renderUsersList();
    renderGroupsList();
    renderMainChat();

    // ============ RENDER FUNCTIONS ============
    function renderUsersList() {
        if (!usersListElement) return;

        usersListElement.innerHTML = '';

        users.forEach(user => {
            const item = document.createElement('div');
            item.classList.add('chat-item');
            if (selectedChat === user && chatType === 'private') {
                item.classList.add('active');
            }
            item.innerHTML = `<span class="chat-icon icon-user"></span> ${user}`;
            item.addEventListener('click', () => selectChat(user, 'private'));
            usersListElement.appendChild(item);
        });
    }

    function renderGroupsList() {
        if (!groupsListElement) return;

        groupsListElement.innerHTML = '';

        groups.forEach(group => {
            const item = document.createElement('div');
            item.classList.add('chat-item');
            if (selectedChat === group.name && chatType === 'group') {
                item.classList.add('active');
            }
            item.innerHTML = `<span class="chat-icon icon-group"></span> ${group.name}`;
            item.addEventListener('click', () => selectChat(group.name, 'group'));
            groupsListElement.appendChild(item);
        });
    }

    function selectChat(chatName, type) {
        const chatKey = `${type}_${chatName}`;

        // Guardar mensajes actuales en caché
        if (selectedChat) {
            const currentKey = `${chatType}_${selectedChat}`;
            messageCache[currentKey] = [...messages];
        }

        selectedChat = chatName;
        chatType = type;

        // Recuperar mensajes del caché (si existen) o inicializar vacío
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

        // Chat Header
        const chatHeader = createChatHeader();

        // Messages Container
        const messagesContainer = createMessagesContainer();

        // Input Container
        const inputContainer = createInputContainer();

        mainChat.appendChild(chatHeader);
        mainChat.appendChild(messagesContainer);
        mainChat.appendChild(inputContainer);

        // Scroll to bottom
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 0);
    }

    function renderEmptyState() {
        const emptyState = document.createElement('div');
        emptyState.classList.add('empty-state');
        emptyState.innerHTML = `
            <div class="empty-state-icon icon-message"></div>
            <p>Select a chat to start messaging</p>
        `;
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
        chatSubtitle.textContent = chatType === 'private' ? 'Private Chat' : 'Group Chat';

        chatHeaderInfo.appendChild(chatTitle);
        chatHeaderInfo.appendChild(chatSubtitle);

        const historyBtn = document.createElement('button');
        historyBtn.classList.add('history-btn');
        historyBtn.innerHTML = '<span class="icon-history"></span> View History';
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

        header.appendChild(chatHeaderInfo);
        header.appendChild(historyBtn);
        header.appendChild(refreshBtn);

        return header;
    }

    function createMessagesContainer() {
        const messagesContainer = document.createElement('div');
        messagesContainer.classList.add('messages-container');
        messagesContainer.id = 'messagesContainer';

        if (messages.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.style.textAlign = 'center';
            emptyMsg.style.color = '#8e8e93';
            emptyMsg.style.marginTop = '40px';
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
                content.textContent = msg.content;
                message.appendChild(content);

                const time = document.createElement('div');
                time.classList.add('message-time');
                time.textContent = msg.timestamp;
                message.appendChild(time);

                wrapper.appendChild(message);
                messagesContainer.appendChild(wrapper);
            });
        }

        return messagesContainer;
    }

    function updateMessagesContainer(newMessages) {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;

        // Limpiar sin borrar el input ni el header
        messagesContainer.innerHTML = '';

        if (newMessages.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.style.textAlign = 'center';
            emptyMsg.style.color = '#8e8e93';
            emptyMsg.style.marginTop = '40px';
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
            content.textContent = msg.content;
            message.appendChild(content);

            const time = document.createElement('div');
            time.classList.add('message-time');
            time.textContent = msg.timestamp;
            message.appendChild(time);

            wrapper.appendChild(message);
            messagesContainer.appendChild(wrapper);
        });

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }


    function createInputContainer() {
        const inputContainer = document.createElement('div');
        inputContainer.classList.add('input-container');

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
        sendBtn.innerHTML = '<span class="icon-send"></span> Send';
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

    function renderHistoryView() {
        const historyContainer = document.createElement('div');
        historyContainer.classList.add('history-container');

        const historyContent = document.createElement('div');
        historyContent.classList.add('history-content');

        const historyHeader = document.createElement('div');
        historyHeader.classList.add('history-header');

        const title = document.createElement('h3');
        title.textContent = 'Chat History';

        const backBtn = document.createElement('button');
        backBtn.classList.add('back-btn');
        backBtn.textContent = 'Back to Chat';
        backBtn.addEventListener('click', () => {
            currentView = 'chat';
            renderMainChat();
        });

        historyHeader.appendChild(title);
        historyHeader.appendChild(backBtn);

        const historyBox = document.createElement('div');
        historyBox.classList.add('history-box');

        if (historyData.length === 0) {
            historyBox.innerHTML = '<p style="text-align: center; color: #8e8e93;">No history available</p>';
        } else {
            historyData.forEach(item => {
                const historyItem = document.createElement('div');
                historyItem.classList.add('history-item');
                historyItem.textContent = item;
                historyBox.appendChild(historyItem);
            });
        }

        historyContent.appendChild(historyHeader);
        historyContent.appendChild(historyBox);
        historyContainer.appendChild(historyContent);
        mainChat.appendChild(historyContainer);
    }

    // ============ ACTION HANDLERS ============
    let messagePollingInterval = null; // para polling cuando hay un chat seleccionado

    async function sendMessage() {
        const input = document.getElementById('messageInput');
        const errorDiv = document.getElementById('errorMessage');
        const message = input.value.trim();

        if (!message) return;

        try {
            errorDiv.classList.add('hidden');
            let response;

            if (chatType === 'private') {
                // selectedChat expected to be a string (username)
                const recipient = typeof selectedChat === 'object' ? selectedChat.name : selectedChat;
                response = await ChatService.sendPrivateMessage(currentUser, recipient, message);
            } else {
                // ensure groupName is a string
                const groupName = typeof selectedChat === 'object' ? selectedChat.name : selectedChat;
                response = await ChatService.sendGroupMessage(currentUser, groupName, message);
            }

            // Verificar si hubo error
            if (response.error || response.status === 'error') {
                throw new Error(response.error || response.message);
            }

            // Agregar mensaje a la lista local (como objeto)
            messages.push({
                sender: currentUser,
                content: message,
                timestamp: new Date().toLocaleTimeString()
            });

            // Actualizar caché
            const chatKey = `${chatType}_${typeof selectedChat === 'object' ? selectedChat.name : selectedChat}`;
            messageCache[chatKey] = [...messages];

            input.value = '';
            updateMessagesContainer(messages);

        } catch (err) {
            errorDiv.textContent = 'Failed to send message: ' + err.message;
            errorDiv.classList.remove('hidden');
        }
    }

    async function loadHistory() {
        try {
            let response;
            if (chatType === 'private') {
                response = await ChatService.getPrivateHistory(username, selectedChat);
            } else {
                response = await ChatService.getGroupHistory(selectedChat);
            }

            historyData = Array.isArray(response) ? response : [];
            currentView = 'history';
            renderMainChat();

        } catch (err) {
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
            let history;
            if (chatType === 'private') {
                // ⚠️ Usa currentUser o username correcto
                history = await ChatService.getPrivateHistory(currentUser || username, selectedChat);
            } else {
                const groupName = typeof selectedChat === 'object' ? selectedChat.name : selectedChat;
                history = await ChatService.getGroupHistory(groupName);
            }

            if (!Array.isArray(history)) {
                console.warn(" No se recibió un arreglo de historial");
                return;
            }

            const parsedMessages = history.map(line => parseHistoryLine(line));

            // Solo actualiza si el contenido cambió
            const newData = JSON.stringify(parsedMessages);
            const oldData = JSON.stringify(messages);

            if (newData !== oldData) {
                messages = parsedMessages;
                const chatKey = `${chatType}_${typeof selectedChat === 'object' ? selectedChat.name : selectedChat}`;
                messageCache[chatKey] = [...messages];
                updateMessagesContainer(messages);
            } else {
                // No hacer nada si no hay cambios → evita borrar contenido
            }

        } catch (err) {
            console.error('Error in refreshMessages:', err);
        }
    }

    // parsea una línea de historial si viene en texto "[date] sender en group: message"
    // devuelve { sender, content, timestamp }
    function parseHistoryLine(line) {
        try {
            // Si el servidor ya devuelve objetos JSON, devuelve tal cual
            if (typeof line === 'object' && line !== null) {
                return {
                    sender: line.sender || 'unknown',
                    content: line.message || line.content || JSON.stringify(line),
                    timestamp: line.timestamp || ''
                };
            }

            // Si es string, intentamos extraer sender y mensaje
            // Ejemplo: "[2025-11-08 21:13:59] unknown en Ismael: hola"
            const regex = /^\[([^\]]+)\]\s*([^:]+):\s*(.*)$/;
            const m = line.match(regex);
            if (m) {
                const timestamp = m[1];
                const senderPart = m[2]; // Esto será "daniel -> user2" o "daniel en Grupo"
                const content = m[3];
                let sender;

                // Limpiar el string del remitente
                if (senderPart.includes(' -> ')) {
                    sender = senderPart.split(' -> ')[0].trim();
                } else if (senderPart.includes(' en ')) {
                    sender = senderPart.split(' en ')[0].trim();
                } else {
                    sender = senderPart.trim();
                }
                return { sender: sender || 'unknown', content, timestamp };
            }

            // fallback
            return { sender: 'unknown', content: String(line), timestamp: '' };
        } catch (e) {
            return { sender: 'unknown', content: String(line), timestamp: '' };
        }
    }


    function handleLogout() {
        sessionStorage.removeItem('username');
        document.getElementById('app').innerHTML = '';
        // Dynamically import Home to avoid circular dependency
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
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
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
                const response = await ChatService.createGroup(groupName, usersStr);

                // Verificar si el grupo se creó exitosamente
                if (response.status === 'ok') {
                    groups.push({
                        name: groupName,
                        members: response.members || []
                    });
                    renderGroupsList();
                    document.body.removeChild(modal);

                    // Mostrar advertencia si hay usuarios inválidos
                    if (response.invalidUsers && response.invalidUsers.length > 0) {
                        alert('Group created, but some users were invalid: ' + response.invalidUsers.join(', '));
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

        // Close modal on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });

        // Focus on first input
        setTimeout(() => groupNameInput.focus(), 100);
    }

    return container;
}