package com.icesi.chatapp.Server;

import java.io.*;
import java.net.*;
import java.util.*;
import com.google.gson.*;

public class Server {
    private static final int PORT = 12345;

    // Mantener registro de usuarios conectados por sesión
    private static final Map<String, String> userSessions = Collections.synchronizedMap(new HashMap<>());

    // Usuarios conectados (simulado)
    private static final Set<String> connectedUsers = Collections.synchronizedSet(new HashSet<>());

    // Flujos de salida activos (para enviar mensajes en vivo)
    private static final Map<String, PrintWriter> activeConnections = Collections.synchronizedMap(new HashMap<>());

    // Grupos creados
    private static final Map<String, Set<String>> groups = Collections.synchronizedMap(new HashMap<>());

    public static void main(String[] args) {
        System.out.println("Servidor TCP JSON iniciado en el puerto " + PORT + "...");

        try (ServerSocket serverSocket = new ServerSocket(PORT)) {
            while (true) {
                Socket socket = serverSocket.accept();
                System.out.println("Nueva conexión desde: " + socket.getInetAddress());
                new Thread(() -> handleClient(socket)).start();
            }
        } catch (IOException e) {
            System.err.println("Error en el servidor: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static void handleClient(Socket socket) {
        try (
                BufferedReader in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
                PrintWriter out = new PrintWriter(socket.getOutputStream(), true)) {
            String currentUser = null;
            String input = in.readLine();
            if (input == null || input.trim().isEmpty()) {
                System.err.println("Petición vacía recibida");
                return;
            }

            System.out.println("Petición recibida: " + input);

            JsonObject request = JsonParser.parseString(input).getAsJsonObject();
            String action = request.get("action").getAsString();
            JsonObject data = request.getAsJsonObject("data");
            JsonObject response = new JsonObject();

            switch (action) {
                case "0": // Register user session
                    handleRegisterUser(data, response);
                    currentUser = data.get("username").getAsString();
                    activeConnections.put(currentUser, out);
                    break;
                case "1": // Private message
                    handlePrivateMessage(data, response);
                    break;
                case "2": // Create group
                    handleCreateGroup(data, response);
                    break;
                case "3": // Group message
                    handleGroupMessage(data, response);
                    break;
                case "7": // Get private history
                    handleGetPrivateHistory(data, response);
                    break;
                case "8": // Get group history
                    handleGetGroupHistory(data, response);
                    break;
                case "9": // Get connected users
                    handleGetConnectedUsers(response);
                    break;
                case "10": // Get all groups
                    handleGetAllGroups(response);
                    break;
                default:
                    response.addProperty("status", "error");
                    response.addProperty("message", "Unknown action: " + action);
            }

            String responseStr = response.toString();
            System.out.println("Respuesta enviada: " + responseStr);
            out.println(responseStr);

            if (currentUser != null) {
                activeConnections.remove(currentUser);
            }

        } catch (Exception e) {
            System.err.println("Error manejando cliente: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static void handleRegisterUser(JsonObject data, JsonObject response) {
        try {
            String username = data.get("username").getAsString();
            String sessionId = data.get("sessionId").getAsString();

            // Registrar usuario en el sistema
            if (!connectedUsers.contains(username)) {
                connectedUsers.add(username);
            }
            userSessions.put(sessionId, username);

            response.addProperty("status", "ok");
            response.addProperty("message", "User registered: " + username);

            System.out.println("Usuario registrado: " + username + " (session: " + sessionId + ")");

        } catch (Exception e) {
            response.addProperty("status", "error");
            response.addProperty("message", "Error registering user: " + e.getMessage());
        }
    }

    private static void handlePrivateMessage(JsonObject data, JsonObject response) {
        try {
            String recipient = data.get("recipient").getAsString();
            String message = data.get("message").getAsString();
            String sessionId = data.has("sessionId") ? data.get("sessionId").getAsString() : null;

            // Obtener remitente real desde sessionId
            String sender = (sessionId != null && userSessions.containsKey(sessionId))
                    ? userSessions.get(sessionId)
                    : data.has("sender") ? data.get("sender").getAsString() : "unknown";

            if (!connectedUsers.contains(recipient)) {
                response.addProperty("status", "error");
                response.addProperty("message", "User not found: " + recipient);
                return;
            }

            // Guardar historial
            MessageHistory.savePrivateMessage(sender, recipient, message);

            // Crear respuesta común
            JsonObject msg = new JsonObject();
            msg.addProperty("status", "ok");
            msg.addProperty("type", "privateMessage");
            msg.addProperty("sender", sender);
            msg.addProperty("recipient", recipient);
            msg.addProperty("message", message);

            // Enviar al destinatario si está conectado
            if (activeConnections.containsKey(recipient)) {
                activeConnections.get(recipient).println(msg.toString());
            }

            // Enviar confirmación al remitente
            response.addProperty("status", "ok");
            response.addProperty("message", "Private message sent");
            response.addProperty("sender", sender);

            System.out.println("Mensaje privado: " + sender + " -> " + recipient + ": " + message);

        } catch (Exception e) {
            response.addProperty("status", "error");
            response.addProperty("message", "Error sending private message: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static void handleCreateGroup(JsonObject data, JsonObject response) {
        try {
            String groupName = data.get("groupName").getAsString();
            String usersStr = data.get("users").getAsString();

            // Parsear usuarios - remover espacios extras
            String[] userArray = usersStr.split(",");
            Set<String> groupUsers = new HashSet<>();
            List<String> invalidUsers = new ArrayList<>();

            for (String user : userArray) {
                String trimmedUser = user.trim();
                if (!trimmedUser.isEmpty()) {
                    if (connectedUsers.contains(trimmedUser)) {
                        groupUsers.add(trimmedUser);
                    } else {
                        invalidUsers.add(trimmedUser);
                    }
                }
            }

            // Si no hay usuarios válidos, retornar error
            if (groupUsers.isEmpty()) {
                response.addProperty("status", "error");
                response.addProperty("message", "No valid users found");

                JsonArray availableUsers = new JsonArray();
                for (String user : connectedUsers) {
                    availableUsers.add(user);
                }
                response.add("availableUsers", availableUsers);

                JsonArray invalid = new JsonArray();
                for (String user : invalidUsers) {
                    invalid.add(user);
                }
                response.add("invalidUsers", invalid);
                return;
            }

            // Crear el grupo
            groups.put(groupName, groupUsers);

            response.addProperty("status", "ok");
            response.addProperty("message", "Group '" + groupName + "' created with " + groupUsers.size() + " members");

            JsonArray members = new JsonArray();
            for (String user : groupUsers) {
                members.add(user);
            }
            response.add("members", members);

            if (!invalidUsers.isEmpty()) {
                JsonArray invalid = new JsonArray();
                for (String user : invalidUsers) {
                    invalid.add(user);
                }
                response.add("invalidUsers", invalid);
            }

            System.out.println("Grupo creado: " + groupName + " con usuarios: " + groupUsers);

        } catch (Exception e) {
            response.addProperty("status", "error");
            response.addProperty("message", "Error creating group: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static void handleGroupMessage(JsonObject data, JsonObject response) {
        try {
            String groupName = data.get("groupName").getAsString();
            String message = data.get("message").getAsString();
            String sessionId = data.has("sessionId") ? data.get("sessionId").getAsString() : null;

            String sender = (sessionId != null && userSessions.containsKey(sessionId))
                    ? userSessions.get(sessionId)
                    : data.has("sender") ? data.get("sender").getAsString() : "unknown";

            if (!groups.containsKey(groupName)) {
                response.addProperty("status", "error");
                response.addProperty("message", "Group not found: " + groupName);
                return;
            }

            MessageHistory.saveGroupMessage(sender, groupName, message);

            // Enviar mensaje a todos los miembros del grupo conectados
            for (String member : groups.get(groupName)) {
                if (activeConnections.containsKey(member) && !member.equals(sender)) {
                    JsonObject msg = new JsonObject();
                    msg.addProperty("type", "groupMessage");
                    msg.addProperty("sender", sender);
                    msg.addProperty("group", groupName);
                    msg.addProperty("message", message);
                    activeConnections.get(member).println(msg.toString());
                }
            }

            response.addProperty("status", "ok");
            response.addProperty("message", "Message sent to group " + groupName);
            response.addProperty("sender", sender);

            System.out.println("Mensaje grupal: " + sender + " en " + groupName + ": " + message);

        } catch (Exception e) {
            response.addProperty("status", "error");
            response.addProperty("message", "Error sending group message: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static void handleGetPrivateHistory(JsonObject data, JsonObject response) {
        try {
            String user = data.get("user").getAsString();
            String currentUser = data.has("currentUser") ? data.get("currentUser").getAsString() : null;

            if (currentUser == null) {
                response.addProperty("status", "error");
                response.addProperty("message", "Current user not specified");
                return;
            }

            List<String> history = MessageHistory.getPrivateHistory(currentUser, user);

            response.addProperty("status", "ok");

            JsonArray historyArray = new JsonArray();
            for (String line : history) {
                historyArray.add(line);
            }
            response.add("history", historyArray);

            System.out.println("Historial privado recuperado: " + currentUser + " <-> " + user + " (" + history.size()
                    + " mensajes)");

        } catch (Exception e) {
            response.addProperty("status", "error");
            response.addProperty("message", "Error getting private history: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static void handleGetGroupHistory(JsonObject data, JsonObject response) {
        try {
            String groupName = data.get("groupName").getAsString();

            List<String> history = MessageHistory.getGroupHistory(groupName);

            response.addProperty("status", "ok");

            JsonArray historyArray = new JsonArray();
            for (String line : history) {
                historyArray.add(line);
            }
            response.add("history", historyArray);

            System.out.println("Historial de grupo recuperado: " + groupName + " (" + history.size() + " mensajes)");

        } catch (Exception e) {
            response.addProperty("status", "error");
            response.addProperty("message", "Error getting group history: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static void handleGetConnectedUsers(JsonObject response) {
        try {
            JsonArray usersArray = new JsonArray();
            for (String user : connectedUsers) {
                usersArray.add(user);
            }

            response.addProperty("status", "ok");
            response.add("users", usersArray);

            System.out.println("Lista de usuarios enviada: " + connectedUsers);

        } catch (Exception e) {
            response.addProperty("status", "error");
            response.addProperty("message", "Error getting users: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static void handleGetAllGroups(JsonObject response) {
        try {
            JsonArray groupsArray = new JsonArray();
            for (Map.Entry<String, Set<String>> entry : groups.entrySet()) {
                JsonObject groupObj = new JsonObject();
                groupObj.addProperty("name", entry.getKey());

                JsonArray membersArray = new JsonArray();
                for (String member : entry.getValue()) {
                    membersArray.add(member);
                }
                groupObj.add("members", membersArray);

                groupsArray.add(groupObj);
            }

            response.addProperty("status", "ok");
            response.add("groups", groupsArray);

            System.out.println("Lista de grupos enviada: " + groups.keySet());

        } catch (Exception e) {
            response.addProperty("status", "error");
            response.addProperty("message", "Error getting groups: " + e.getMessage());
            e.printStackTrace();
        }
    }
}