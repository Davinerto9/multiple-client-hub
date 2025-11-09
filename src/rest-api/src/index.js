const express = require('express');
const cors = require('cors');
const delegate = require('./services/delegateService.js');

const app = express();
app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
    if (req.path === '/register') return next();
    // Puede venir en el body, query o header
    const username =
        req.body?.username ||
        req.body?.sender ||
        req.body?.currentUser ||
        req.query?.username ||
        req.headers['x-username'];

    if (username) {
        delegate.setCurrentUser(username);
        console.log(`🔹 Current user set to: ${username}`);
    }

    next();
});

// Get connected users
app.get('/users', async (req, res) => {
    try {
        console.log('GET /users - Solicitando usuarios conectados');
        const response = await delegate.getConnectedUsers();

        console.log('Response from Java server:', response);

        if (response.status === 'ok' && response.users) {
            res.status(200).json(response.users);
        } else {
            res.status(200).json([]);
        }
    } catch (err) {
        console.error('Error getting users:', err);
        res.status(200).json([]);
    }
});

// Get all groups
app.get('/groups', async (req, res) => {
    try {
        console.log('GET /groups - Solicitando grupos');
        const response = await delegate.getAllGroups();

        console.log('Response from Java server:', response);

        if (response.status === 'ok' && response.groups) {
            res.status(200).json(response.groups);
        } else {
            res.status(200).json([]);
        }
    } catch (err) {
        console.error('Error getting groups:', err);
        res.status(200).json([]); // Retornar array vacío en caso de error
    }
});

// Create a group
app.post('/groups', async (req, res) => {
    try {
        const { groupName, users } = req.body;

        if (!groupName || !users) {
            return res.status(400).json({ error: 'Group name and users are required' });
        }

        console.log('POST /groups - Creating group:', { groupName, users });
        const response = await delegate.createGroup(groupName, users);

        if (response.status === 'ok') {
            res.status(200).json(response);
        } else {
            res.status(400).json({ error: response.message || 'Error creating group' });
        }
    } catch (err) {
        console.error('Error creating group:', err);
        res.status(500).json({ error: 'Error creating group: ' + err.message });
    }
});

// Send private message
app.post('/private', async (req, res) => {
    try {
        const { sender, recipient, message } = req.body;

        if (!sender || !recipient || !message) {
            return res.status(400).json({ error: 'Sender, recipient and message are required' });
        }

        console.log(`POST /private - ${sender} -> ${recipient}`);
        const response = await delegate.sendPrivateMessage(sender, recipient, message);

        if (response.status === 'ok') {
            res.status(200).json(response);
        } else {
            res.status(400).json({ error: response.message || 'Error sending message' });
        }
    } catch (err) {
        console.error('Error sending private message:', err);
        res.status(500).json({ error: 'Error sending private message: ' + err.message });
    }
});

//Send group message
app.post('/group', async (req, res) => {
    try {
        const { sender, groupName, message } = req.body;

        if (!sender || !groupName || !message) {
            return res.status(400).json({ error: 'Sender, group name and message are required' });
        }

        console.log(`POST /group - ${sender} -> ${groupName}`);
        const response = await delegate.sendGroupMessage(sender, groupName, message);

        if (response.status === 'ok') {
            res.status(200).json(response);
        } else {
            res.status(400).json({ error: response.message || 'Error sending message' });
        }
    } catch (err) {
        console.error('Error sending group message:', err);
        res.status(500).json({ error: 'Error sending group message: ' + err.message });
    }
});


// Get group history
app.get('/group/:name', async (req, res) => {
    try {
        const groupName = req.params.name;

        if (!groupName) {
            return res.status(400).json({ error: 'Group name parameter is required' });
        }

        console.log('GET /group/:name - Getting history for group:', groupName);
        const response = await delegate.getGroupHistory(groupName);

        if (response.status === 'ok' && response.history) {
            res.status(200).json(response.history);
        } else {
            res.status(200).json([]);
        }
    } catch (err) {
        console.error('Error getting group history:', err);
        res.status(200).json([]);
    }
});

// Register user
app.post('/register', async (req, res) => {
    const { username, sessionId } = req.body;
    try {
        console.log('POST /register -', { username, sessionId });
        delegate.setCurrentUser(username);
        const response = await delegate.registerUser(username, sessionId);
        res.status(200).json(response);
    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update private history endpoint
app.get('/private/:currentUser/:user', async (req, res) => {
    try {
        const { currentUser, user } = req.params;
        console.log('GET /private/:currentUser/:user -', { currentUser, user });
        const response = await delegate.getPrivateHistory(currentUser, user);

        if (response.status === 'ok' && response.history) {
            res.status(200).json(response.history);
        } else {
            res.status(200).json([]);
        }
    } catch (err) {
        console.error('Error getting private history:', err);
        res.status(200).json([]);
    }
});

app.delete('/groups/:name', async (req, res) => {
  try {
    const groupName = req.params.name;
    console.log('DELETE /groups/:name', groupName);

    if (!groupName) {
      return res.status(400).json({ status: 'error', message: 'Group name is required' });
    }

    const response = await delegate.deleteGroup(groupName);
    if (response.status === 'ok') {
      return res.status(200).json(response);
    } else {
      return res.status(400).json({ status: 'error', message: response.message || 'Error deleting group' });
    }
  } catch (err) {
    console.error('Error deleting group:', err);
    return res.status(500).json({ status: 'error', message: 'Error deleting group: ' + err.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Proxy server is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy HTTP server running on http://localhost:${PORT}`);
    console.log(` Connecting to Java server at localhost:12345`);
    console.log('');
    console.log('Available endpoints:');
    console.log('  GET  /users          - Get connected users');
    console.log('  GET  /groups         - Get all groups');
    console.log('  POST /groups         - Create new group');
    console.log('  POST /private        - Send private message');
    console.log('  POST /group          - Send group message');
    console.log('  GET  /private/:user  - Get private history');
    console.log('  GET  /group/:name    - Get group history');
    console.log('  POST /register       - Register user');
    console.log('  DELETE /groups/:name - Delete a group');
    console.log('  GET  /health         - Health check');
});