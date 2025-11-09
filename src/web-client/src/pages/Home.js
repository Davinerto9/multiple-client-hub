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

    button.addEventListener('click', () => {
        const username = input.value.trim();
        if (!username) {
            message.textContent = 'Please enter a username.';
            return;
        }

        sessionStorage.setItem('username', username);
        document.getElementById('app').innerHTML = '';
        document.getElementById('app').appendChild(ChatApp(username));
    });

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            button.click();
        }
    });

    content.appendChild(mainTitle);
    content.appendChild(subtitle);
    content.appendChild(input);
    content.appendChild(button);
    content.appendChild(message);

    container.appendChild(content);
    return container;
}