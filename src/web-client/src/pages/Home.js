import ChatApp from './ChatApp.js';

export function Home() {
  const container = document.createElement('div');
  container.classList.add('home-container');

  const content = document.createElement('div');
  content.classList.add('home-content');

  const mainTitle = document.createElement('h1');
  mainTitle.textContent = 'Welcome to our Chat Application!';
  mainTitle.classList.add('title');

  const subtitle = document.createElement('h2');
  subtitle.textContent = 'Enter your username';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Username';
  input.id = 'usernameInput';

  const button = document.createElement('button');
  button.textContent = 'Enter Chat';

  const message = document.createElement('p');
  message.id = 'homeMessage';
  message.style.marginTop = '10px';
  message.style.minHeight = '20px';

  const iceStatus = document.createElement('div');
  iceStatus.style.marginTop = '15px';
  iceStatus.style.fontSize = '0.9em';
  iceStatus.style.color = '#666';
  iceStatus.id = 'iceStatus';

  function verifyIceLoaded() {
    if (!window.Ice) {
      iceStatus.textContent = '⚠️ Ice.js no está cargado';
      iceStatus.style.color = '#e11d48';
      return false;
    }

    if (!window.ChatApp) {
      iceStatus.textContent = '⚠️ Chat.js no está cargado';
      iceStatus.style.color = '#e11d48';
      return false;
    }

    if (!window.ChatService) {
      iceStatus.textContent = '⚠️ ChatService.js no está cargado';
      iceStatus.style.color = '#e11d48';
      return false;
    }

    iceStatus.textContent = '✅ Ice listo';
    iceStatus.style.color = '#10b981';
    return true;
  }

  setTimeout(verifyIceLoaded, 100);

  button.addEventListener('click', async () => {
    const username = input.value.trim();
    if (!username) {
      message.textContent = 'Please enter a username.';
      message.style.color = '#e11d48';
      return;
    }

    if (!verifyIceLoaded()) {
      message.textContent = 'Ice no está disponible. Recarga la página.';
      message.style.color = '#e11d48';
      return;
    }

    try {
      button.disabled = true;
      input.disabled = true;
      button.textContent = 'Connecting...';
      message.textContent = '';
      iceStatus.textContent = '🔌 Conectando a Ice...';
      iceStatus.style.color = '#3b82f6';

      const ChatService = window.ChatService;
      console.log('═══════════════════════════════════════════');
      console.log('🔄 Iniciando conexión Ice para:', username);
      console.log('═══════════════════════════════════════════');

      // Callbacks dummy: se reenviarán cuando ChatApp exista
      const dummyCallbacks = {
        onMessage: (data) => {
          console.log('🔔 [DUMMY] onMessage:', data);
          if (window.currentChatApp && window.currentChatApp.handleIncomingMessage) {
            window.currentChatApp.handleIncomingMessage(data);
          }
        },
        onVoiceNote: (data) => {
          console.log('🔔 [DUMMY] onVoiceNote');
          if (window.currentChatApp && window.currentChatApp.handleIncomingVoiceNote) {
            window.currentChatApp.handleIncomingVoiceNote(data);
          }
        },
        onCall: (data) => {
          console.log('🔔 [DUMMY] onCall:', data.type);
          if (window.currentChatApp && window.currentChatApp.handleCallEvent) {
            window.currentChatApp.handleCallEvent(data);
          }
        },
        onUserStatus: (data) => {
          console.log('🔔 [DUMMY] onUserStatus:', data.username, data.online);
          if (window.currentChatApp && window.currentChatApp.handleUserStatusChange) {
            window.currentChatApp.handleUserStatusChange(data);
          }
        },
        onGroupUpdate: (data) => {
          console.log('🔔 [DUMMY] onGroupUpdate:', data.type);
          if (window.currentChatApp && window.currentChatApp.handleGroupUpdate) {
            window.currentChatApp.handleGroupUpdate(data);
          }
        }
      };

      const iceConnected = await ChatService.initialize(username, dummyCallbacks);
      if (!iceConnected) {
        throw new Error('No se pudo conectar a Ice');
      }

      // Verificar que el proxy esté listo
      if (!ChatService.chatServicePrx) {
        throw new Error('Ice proxy no está disponible');
      }

      console.log('✅ Ice conectado y proxy verificado');
      iceStatus.textContent = '✅ Ice conectado';
      iceStatus.style.color = '#10b981';

      // Guardar en sessionStorage para reconexión automática en ChatApp.ensureIceConnection
      sessionStorage.setItem('username', username);
      sessionStorage.setItem('iceConnected', 'true');

      message.textContent = 'Connected! Loading chat...';
      message.style.color = '#10b981';

      // Crear ChatApp
      console.log('🚀 Creando ChatApp...');
      const app = document.getElementById('app');
      app.innerHTML = '';

      const chatAppElement = ChatApp(username);
      app.appendChild(chatAppElement);

      // Referencia global para callbacks
      window.currentChatApp = chatAppElement;

      console.log('✅ ChatApp creado y montado en el DOM');
      console.log('═══════════════════════════════════════════');

      // Cargar datos iniciales desde ChatApp
      if (chatAppElement.loadInitialData) {
        setTimeout(() => {
          chatAppElement.loadInitialData();
        }, 100);
      }
    } catch (err) {
      console.error('═══════════════════════════════════════════');
      console.error('❌ Error connecting:', err.message);
      console.error(' Stack:', err.stack);
      console.error('═══════════════════════════════════════════');

      message.textContent = 'Error connecting: ' + err.message;
      message.style.color = '#e11d48';
      iceStatus.textContent = '❌ Error de conexión';
      iceStatus.style.color = '#e11d48';

      button.disabled = false;
      input.disabled = false;
      button.textContent = 'Enter Chat';
    }
  });

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !button.disabled) {
      button.click();
    }
  });

  content.appendChild(mainTitle);
  content.appendChild(subtitle);
  content.appendChild(input);
  content.appendChild(button);
  content.appendChild(message);
  content.appendChild(iceStatus);
  container.appendChild(content);

  return container;
}
