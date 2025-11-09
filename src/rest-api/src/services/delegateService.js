const net = require('net');

class DelegateService {
    constructor() {
        this.serverPort = 12345;
        this.serverHost = 'localhost';
        this.currentUser = null;
    }

    async setCurrentUser(username) {
        this.currentUser = username;
    }

    async connectToServer() {
        return new Promise((resolve, reject) => {
            const socket = new net.Socket();
            socket.setTimeout(10000);

            socket.connect(this.serverPort, this.serverHost, () => {
                console.log('Connected to Java server');
                resolve(socket);
            });

            socket.on('error', (err) => {
                console.error('Socket error:', err.message);
                reject(err);
            });

            socket.on('timeout', () => {
                socket.destroy();
                reject(new Error('Connection timeout'));
            });
        });
    }

    async sendRequest(action, data) {
        return new Promise(async (resolve, reject) => {
            let socket;
            try {
                socket = await this.connectToServer();

                // Incluimos el usuario actual en cada petición
                const request = JSON.stringify({
                    action,
                    currentUser: this.currentUser || 'unknown',  // ← Aquí se agrega
                    data
                }) + '\n';

                console.log('Sending request:', { action, data, currentUser: this.currentUser });
                socket.write(request);

                let buffer = '';
                socket.on('data', (data) => {
                    buffer += data.toString();

                    if (buffer.includes('\n')) {
                        const response = buffer.trim();
                        socket.end();
                        console.log('Received response:', response);

                        try {
                            const parsed = JSON.parse(response);
                            resolve(parsed);
                        } catch {
                            resolve({ message: response });
                        }
                    }
                });

                socket.on('error', (err) => {
                    console.error('Socket error:', err);
                    socket.destroy();
                    reject(err);
                });

                socket.on('close', () => {
                    if (buffer && !buffer.includes('\n')) {
                        try {
                            resolve(JSON.parse(buffer));
                        } catch {
                            resolve({ message: buffer || 'Connection closed' });
                        }
                    }
                });

            } catch (err) {
                if (socket) socket.destroy();
                reject(err);
            }
        });
    }

    async createGroup(groupName, users) {
        return this.sendRequest('2', {
            groupName,
            users: Array.isArray(users) ? users.join(',') : users
        });
    }

    async sendPrivateMessage(recipient, message) {
        return this.sendRequest('1', {
            sender,
            recipient,
            message
        });
    }

    async sendGroupMessage(groupName, message) {
        return this.sendRequest('3', {
            sender,
            groupName,
            message
        });
    }

    async getPrivateHistory(currentUser, otherUser) {
        return this.sendRequest('7', {
            currentUser: currentUser,
            user: otherUser
        });
    }

    // Método para registrar usuario
    async registerUser(username, sessionId) {
        return this.sendRequest('0', {
            username: username,
            sessionId: sessionId
        });
    }

    async getGroupHistory(groupName) {
        return this.sendRequest('8', {
            groupName
        });
    }

    // NUEVOS MÉTODOS
    async getConnectedUsers() {
        return this.sendRequest('9', {});
    }

    async getAllGroups() {
        return this.sendRequest('10', {});
    }
}

module.exports = new DelegateService();