package com.icesi.chatapp.ICEServices;

import com.zeroc.Ice.Current;
import ChatApp.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class ChatSubjectImpl implements Subject {

    private Map<String, ChatObserverPrx> observers;
    private Map<String, com.zeroc.Ice.Connection> userConnections;
    private ChatServicesImpl chatServices;

    public ChatSubjectImpl(ChatServicesImpl chatServices) {
        this.observers = new ConcurrentHashMap<>();
        this.userConnections = new ConcurrentHashMap<>();
        this.chatServices = chatServices;
    }

    @Override
    public void attachObserver(String username, ChatObserverPrx observer, Current current) throws UserAlreadyConnectedException{
        System.out.println("═══════════════════════════════════════════");
        System.out.println("ATTACH OBSERVER: " + username);
        chatServices.registerUserConnection(username);
        // Usar ice_fixed para mantener la conexión
        ChatObserverPrx proxy = observer.ice_fixed(current.con);
        
        if (current.con != null) {
            userConnections.put(username, current.con);

            // Callback de limpieza automática cuando se cierra la conexión
            current.con.setCloseCallback(conn -> {
                System.out.println("Conexión cerrada: " + username);
                observers.remove(username);
                userConnections.remove(username);
                notifyUserDisconnected(username);

                chatServices.unregisterUserConnection(username);
            });
        }

        observers.put(username, proxy);
        System.out.println("Observers activos: " + observers.keySet());
        System.out.println("═══════════════════════════════════════════");
    }

    @Override
    public void deAttachObserver(String username, Current current) {
        System.out.println("DETACH OBSERVER: " + username);
        observers.remove(username);
        userConnections.remove(username);
        chatServices.unregisterUserConnection(username);
    }

    // ═══════════════════════════════════════════════════════════════
    // MÉTODOS NOTIFY (INVOCAN CALLBACKS EN CLIENTES)
    // ═══════════════════════════════════════════════════════════════

    public void notifyPrivateMessage(String recipient, String sender, String message, String timestamp) {
        ChatObserverPrx observer = observers.get(recipient);
        if (observer != null) {
            System.out.println("Notificando mensaje privado a: " + recipient);
            try {
                observer.onPrivateMessageAsync(sender, message, timestamp);
            } catch (Exception e) {
                System.err.println("Error notificando a " + recipient + ": " + e.getMessage());
                observers.remove(recipient);
            }
        }
    }

    public void notifyGroupMessage(String groupName, String sender, String message, String timestamp,
            Set<String> members) {
        System.out.println("Notificando mensaje grupal a: " + groupName);
        for (String member : members) {
            if (!member.equals(sender)) {
                ChatObserverPrx observer = observers.get(member);
                if (observer != null) {
                    try {
                        observer.onGroupMessageAsync(sender, groupName, message, timestamp);
                    } catch (Exception e) {
                        System.err.println("Error notificando a " + member);
                        observers.remove(member);
                    }
                }
            }
        }
    }

    public void notifyVoiceNote(String recipient, String sender, AudioMetadata metadata, byte[] data) {
        ChatObserverPrx observer = observers.get(recipient);
        if (observer != null) {
            System.out.println("Notificando nota de voz a: " + recipient);
            try {
                observer.onVoiceNoteReceivedAsync(sender, metadata, data);
            } catch (Exception e) {
                System.err.println("Error notificando audio: " + e.getMessage());
                observers.remove(recipient);
            }
        }
    }

    public void notifyGroupVoiceNote(String recipient, String sender,
            String groupName,
            AudioMetadata metadata, byte[] data) {
        ChatObserverPrx observer = observers.get(recipient);
        if (observer != null) {
            try {
                observer.onGroupVoiceNote(sender, groupName, metadata, data);
            } catch (Exception e) {
                System.err.println("Error notificando nota de voz grupal a "
                        + recipient + ": " + e.getMessage());
            }
        }
    }

    public void notifyIncomingCall(String callee, CallInfo callInfo) {
        ChatObserverPrx observer = observers.get(callee);
        if (observer != null) {
            System.out.println("Notificando llamada entrante a: " + callee);
            try {
                observer.onIncomingCallAsync(callInfo);
            } catch (Exception e) {
                System.err.println("Error notificando llamada: " + e.getMessage());
                observers.remove(callee);
            }
        }
    }

    public void notifyCallAnswered(String caller, String callId, boolean accepted) {
        ChatObserverPrx observer = observers.get(caller);
        if (observer != null) {
            System.out.println("Notificando respuesta de llamada a: " + caller);
            try {
                observer.onCallAnsweredAsync(callId, accepted);
            } catch (Exception e) {
                System.err.println("Error notificando respuesta: " + e.getMessage());
                observers.remove(caller);
            }
        }
    }

    public void notifyCallAudioChunk(String recipient, String callId, String sender, byte[] chunk) {
        ChatObserverPrx observer = observers.get(recipient);
        if (observer != null) {
            try {
                observer.onCallAudioChunkAsync(callId, sender, chunk);
            } catch (Exception e) {
                System.err.println("Error enviando audio chunk: " + e.getMessage());
                observers.remove(recipient);
            }
        }
    }

    public void notifyCallEnded(String username, String callId) {
        ChatObserverPrx observer = observers.get(username);
        if (observer != null) {
            System.out.println("Notificando fin de llamada a: " + username);
            try {
                observer.onCallEndedAsync(callId);
            } catch (Exception e) {
                System.err.println("Error notificando fin: " + e.getMessage());
                observers.remove(username);
            }
        }
    }

    public void notifyUserConnected(String username) {
        System.out.println("Notificando conexión de: " + username + " a todos");
        List<String> disconnected = new ArrayList<>();

        for (Map.Entry<String, ChatObserverPrx> entry : observers.entrySet()) {
            if (!entry.getKey().equals(username)) {
                try {
                    entry.getValue().onUserConnectedAsync(username);
                } catch (Exception e) {
                    disconnected.add(entry.getKey());
                }
            }
        }

        disconnected.forEach(observers::remove);
    }

    public void notifyUserDisconnected(String username) {
        System.out.println("Notificando desconexión de: " + username + " a todos");
        List<String> disconnected = new ArrayList<>();

        for (Map.Entry<String, ChatObserverPrx> entry : observers.entrySet()) {
            if (!entry.getKey().equals(username)) {
                try {
                    entry.getValue().onUserDisconnectedAsync(username);
                } catch (Exception e) {
                    disconnected.add(entry.getKey());
                }
            }
        }

        disconnected.forEach(observers::remove);
    }

    public void notifyGroupCreated(String groupName, String[] members) {
        System.out.println("Notificando creación de grupo: " + groupName);
        List<String> disconnected = new ArrayList<>();

        for (Map.Entry<String, ChatObserverPrx> entry : observers.entrySet()) {
            try {
                entry.getValue().onGroupCreatedAsync(groupName, members);
            } catch (Exception e) {
                disconnected.add(entry.getKey());
            }
        }

        disconnected.forEach(observers::remove);
    }

    public void notifyGroupDeleted(String groupName) {
        System.out.println("Notificando eliminación de grupo: " + groupName);
        List<String> disconnected = new ArrayList<>();

        for (Map.Entry<String, ChatObserverPrx> entry : observers.entrySet()) {
            try {
                entry.getValue().onGroupDeletedAsync(groupName);
            } catch (Exception e) {
                disconnected.add(entry.getKey());
            }
        }

        disconnected.forEach(observers::remove);
    }
}
