const API_URL = 'http://localhost:3000';

export const ChatService = {
    registerUser: async (username) => {
        const sessionId = sessionStorage.getItem('sessionId') || Date.now().toString();
        sessionStorage.setItem('sessionId', sessionId);
        
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, sessionId })
        });
        return await res.json();
    },

    getConnectedUsers: async () => {
        try {
            const res = await fetch(`${API_URL}/users`);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error('Error in getConnectedUsers:', err);
            throw err;
        }
    },

    getAllGroups: async () => {
        try {
            const res = await fetch(`${API_URL}/groups`);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error('Error in getAllGroups:', err);
            throw err;
        }
    },

    createGroup: async (groupName, users) => {
        const res = await fetch(`${API_URL}/groups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupName, users })
        });
        
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to create group');
        }
        
        return await res.json();
    },

    sendPrivateMessage: async (sender, recipient, message) => {
        const res = await fetch(`${API_URL}/private`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-username': sender },
            body: JSON.stringify({ sender, recipient, message })
        });
        return await res.json();
    },

    sendGroupMessage: async (sender, groupName, message) => {
        const res = await fetch(`${API_URL}/group`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-username': sender },
            body: JSON.stringify({ sender, groupName, message })
        });
        return await res.json();
    },

    getPrivateHistory: async (currentUser, user) => {
        const res = await fetch(`${API_URL}/private/${currentUser}/${user}`);
        return await res.json();
    },

    getGroupHistory: async (name) => {
        const res = await fetch(`${API_URL}/group/${name}`);
        return await res.json();
    }
};