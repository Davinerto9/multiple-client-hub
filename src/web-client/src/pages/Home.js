import ChatApp from './ChatApp.js';
import { ChatService } from '../services/chatService.js';

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

  // genera/persiste un sessionId por pestaña
  function getSessionId() {
    let sid = sessionStorage.getItem('sessionId');
    if (!sid) {
      sid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      sessionStorage.setItem('sessionId', sid);
    }
    return sid;
  }

  button.addEventListener('click', async () => {
    const username = input.value.trim();
    if (!username) {
      message.textContent = 'Please enter a username.';
      message.style.color = '#e11d48';
      return;
    }

    try {
      message.textContent = '';
      const sid = getSessionId();

      const r = await ChatService.registerUser(username, sid);
      if (r.status === 'error') {
        message.textContent = r.message || 'Username already in use';
        message.style.color = '#e11d48';
        return;
      }

      // ok, monta el chat
      sessionStorage.setItem('username', username);
      const app = document.getElementById('app');
      app.innerHTML = '';
      app.appendChild(ChatApp(username));
    } catch (err) {
      message.textContent = 'Error registering user: ' + err.message;
      message.style.color = '#e11d48';
    }
  });

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') button.click();
  });

  content.appendChild(mainTitle);
  content.appendChild(subtitle);
  content.appendChild(input);
  content.appendChild(button);
  content.appendChild(message);

  container.appendChild(content);
  return container;
}