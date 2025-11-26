package com.icesi.chatapp.ICEServices;

import com.zeroc.Ice.Current;
import ChatApp.*;

import com.icesi.chatapp.Server.GroupsStorage;
import com.icesi.chatapp.Server.MessageHistory;
import java.util.*;
import java.util.concurrent.*;
import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;

public class ChatServicesImpl implements ChatService {

    private Set<String> connectedUsers;
    private Map<String, Set<String>> groups;
    private Map<String, CallInfo> activeCalls;
    private ChatSubjectImpl subject;

    public ChatServicesImpl(ChatSubjectImpl subject) {
        this.subject = subject;
        this.connectedUsers = ConcurrentHashMap.newKeySet();
        this.groups = GroupsStorage.loadGroups();
        this.activeCalls = new ConcurrentHashMap<>();
    }

    public void setSubject(ChatSubjectImpl subject) {
        this.subject = subject;
    }

    public void registerUserConnection(String username) {
        System.out.println("✅ Registrando usuario en connectedUsers: " + username);
        connectedUsers.add(username);
        subject.notifyUserConnected(username);
    }

    public void unregisterUserConnection(String username) {
        System.out.println("❌ Desregistrando usuario de connectedUsers: " + username);
        connectedUsers.remove(username);
        subject.notifyUserDisconnected(username);
    }

    @Override
    public String[] getConnectedUsers(Current current) {
        return connectedUsers.toArray(new String[0]);
    }

    @Override
    public GroupInfo[] getAllGroups(Current current) {
        List<GroupInfo> groupList = new ArrayList<>();
        for (Map.Entry<String, Set<String>> entry : groups.entrySet()) {
            GroupInfo groupInfo = new GroupInfo();
            groupInfo.name = entry.getKey();
            groupInfo.members = entry.getValue().toArray(new String[0]);
            groupList.add(groupInfo);
        }
        return groupList.toArray(new GroupInfo[0]);
    }

    @Override
    public boolean createGroup(String groupName, String[] members, Current current) {
        System.out.println("═══════════════════════════════════════════");
        System.out.println("📁 Creando grupo: " + groupName);
        System.out.println("   Miembros solicitados: " + Arrays.toString(members));
        System.out.println("   Usuarios conectados: " + connectedUsers);

        if (groupName == null || groupName.trim().isEmpty()) {
            System.err.println("❌ Nombre de grupo vacío");
            return false;
        }

        if (groups.containsKey(groupName)) {
            System.err.println("❌ El grupo ya existe");
            return false;
        }

        if (members == null || members.length < 2) {
            System.err.println("❌ Se requieren al menos 2 miembros");
            return false;
        }

        Set<String> validMembers = ConcurrentHashMap.newKeySet();
        for (String member : members) {
            String cleanMember = member.trim();
            if (!cleanMember.isEmpty()) {
                if (!connectedUsers.contains(cleanMember)) {
                    System.err.println("❌ Usuario NO conectado: " + cleanMember);
                    return false;
                }
                validMembers.add(cleanMember);
            }
        }

        if (validMembers.size() < 2) {
            System.err.println("❌ Se requieren al menos 2 miembros válidos y conectados");
            return false;
        }

        groups.put(groupName, validMembers);
        GroupsStorage.saveGroups(groups);

        System.out.println("✅ Grupo creado exitosamente con " + validMembers.size() + " miembros");
        System.out.println("═══════════════════════════════════════════");

        subject.notifyGroupCreated(groupName, validMembers.toArray(new String[0]));

        return true;
    }

    @Override
    public boolean deleteGroup(String groupName, Current current) {
        System.out.println("🗑️ Eliminando grupo: " + groupName);

        if (!groups.containsKey(groupName)) {
            System.err.println("❌ El grupo no existe");
            return false;
        }

        groups.remove(groupName);
        GroupsStorage.saveGroups(groups);
        MessageHistory.deleteGroupHistory(groupName);
        deleteGroupAudios(groupName);
        subject.notifyGroupDeleted(groupName);

        System.out.println("✅ Grupo eliminado");
        return true;
    }

    private void deleteGroupAudios(String groupName) {
        File dir = new File("src/audio_history");
        File[] files = dir.listFiles();
        if (files == null)
            return;

        String prefix = "group_" + groupName + "_";
        for (File f : files) {
            if (f.getName().startsWith(prefix)) {
                if (!f.delete()) {
                    System.err.println("No se pudo borrar audio de grupo: " + f.getName());
                }
            }
        }
    }

    @Override
    public boolean addMemberToGroup(String groupName, String member, Current current) {
        System.out.println("➕ Agregando " + member + " al grupo " + groupName);

        Set<String> members = groups.get(groupName);
        if (members == null) {
            System.err.println("❌ El grupo no existe");
            return false;
        }

        if (!connectedUsers.contains(member)) {
            System.err.println("❌ El usuario no está conectado");
            return false;
        }

        members.add(member);
        GroupsStorage.saveGroups(groups);
        System.out.println("✅ Miembro agregado");

        subject.notifyGroupCreated(groupName, members.toArray(new String[0]));

        return true;
    }

    @Override
    public boolean removeMemberFromGroup(String groupName, String member, Current current) {
        System.out.println("➖ Removiendo " + member + " del grupo " + groupName);

        Set<String> members = groups.get(groupName);
        if (members == null) {
            return false;
        }

        members.remove(member);

        if (members.isEmpty()) {
            // 🔴 Si no quedan miembros, eliminar el grupo completo
            System.out.println("⚠️ Grupo " + groupName + " quedó sin miembros, eliminando...");
            groups.remove(groupName);
            GroupsStorage.saveGroups(groups);
            MessageHistory.deleteGroupHistory(groupName);
            deleteGroupAudios(groupName);
            subject.notifyGroupDeleted(groupName);
            return true;
        }

        System.out.println("✅ Miembro removido");
        GroupsStorage.saveGroups(groups);

        subject.notifyGroupCreated(groupName, members.toArray(new String[0]));

        return true;
    }

    // ═══════════════════════════════════════════════════════════════
    // MENSAJES - ✅ CORREGIDO
    // ═══════════════════════════════════════════════════════════════

    @Override
    public boolean sendPrivateMessage(String sender, String recipient, String message, Current current) {
        System.out.println("💬 Mensaje: " + sender + " → " + recipient);

        if (!connectedUsers.contains(recipient)) {
            System.err.println("❌ Usuario no conectado");
            return false;
        }

        String timestamp = getCurrentTimestamp();
        MessageHistory.savePrivateMessage(sender, recipient, message);

        // ✅ CORREGIDO: Notificar al DESTINATARIO, no al sender
        subject.notifyPrivateMessage(recipient, sender, message, timestamp);

        System.out.println("✅ Mensaje enviado en tiempo real");
        return true;
    }

    @Override
    public boolean sendGroupMessage(String sender, String groupName, String message, Current current) {
        System.out.println("📁 Mensaje grupal: " + sender + " → " + groupName);

        Set<String> members = groups.get(groupName);
        if (members == null) {
            System.err.println("❌ El grupo no existe");
            return false;
        }

        String timestamp = getCurrentTimestamp();
        MessageHistory.saveGroupMessage(sender, groupName, message);

        subject.notifyGroupMessage(groupName, sender, message, timestamp, members);

        System.out.println("✅ Mensaje grupal enviado en tiempo real");
        return true;
    }

    @Override
    public void clearPrivateHistory(String user1, String user2, Current current) {
        System.out.println("🧹 Borrando historial privado: " + user1 + " <-> " + user2);
        MessageHistory.deletePrivateHistory(user1, user2);
    }

    @Override
    public void clearGroupHistory(String groupName, Current current) {
        System.out.println("🧹 Borrando historial de grupo: " + groupName);
        MessageHistory.deleteGroupHistory(groupName);
        // opcional: borrar audios asociados
        deleteGroupAudios(groupName);
    }

    @Override
    public TextMessage[] getPrivateHistory(String user1, String user2, Current current) {
        System.out.println("📜 Cargando historial: " + user1 + " <-> " + user2);
        List<TextMessage> messages = MessageHistory.loadPrivateHistory(user1, user2);
        System.out.println("✅ Total mensajes: " + messages.size());
        return messages.toArray(new TextMessage[0]);
    }

    @Override
    public TextMessage[] getGroupHistory(String groupName, Current current) {
        System.out.println("📜 Cargando historial grupal: " + groupName);
        List<TextMessage> messages = MessageHistory.loadGroupHistory(groupName);
        return messages.toArray(new TextMessage[0]);
    }

    // ═══════════════════════════════════════════════════════════════
    // AUDIO/VOZ
    // ═══════════════════════════════════════════════════════════════

    @Override
    public boolean sendVoiceNote(String sender, String recipient, AudioMetadata metadata, byte[] data,
            Current current) {
        System.out.println("🎤 Nota de voz: " + sender + " → " + recipient);

        if (!connectedUsers.contains(recipient)) {
            System.err.println("❌ Usuario no conectado");
            return false;
        }

        subject.notifyVoiceNote(recipient, sender, metadata, data);

        String fileName = MessageHistory.savePrivateAudioBytes(sender, recipient, data);
        System.out.println("Audio privado guardo como: " + fileName);

        metadata.size = data.length;
        metadata.timestamp = getCurrentTimestamp();

        System.out.println("✅ Audio enviado en tiempo real (" + data.length + " bytes)");
        return true;
    }

    @Override
    public boolean sendGroupVoiceNote(String sender, String groupName, byte[] data, Current current) {
        System.out.println("🎤 Nota de voz grupal: " + sender + " → " + groupName);

        Set<String> members = groups.get(groupName);
        if (members == null) {
            System.err.println("❌ El grupo no existe");
            return false;
        }

        String fileName = MessageHistory.saveGroupAudioBytes(sender, groupName, data);
        System.out.println("Audio de grupo guardado como: " + fileName);

        String timestamp = getCurrentTimestamp();
        AudioMetadata metadata = new AudioMetadata();
        metadata.sender = sender;
        metadata.timestamp = timestamp;
        metadata.size = data.length;

        for (String member : members) {
            if (!member.equals(sender) && connectedUsers.contains(member)) {
                subject.notifyGroupVoiceNote(member, sender, groupName, metadata, data);
            }
        }

        System.out.println("✅ Audio grupal enviado en tiempo real");
        return true;
    }

    // ═══════════════════════════════════════════════════════════════
    // LLAMADAS - ✅ CORREGIDO
    // ═══════════════════════════════════════════════════════════════

    @Override
    public String initiateCall(String caller, String callee, Current current) {
        System.out.println("📞 Iniciando llamada: " + caller + " → " + callee);

        if (!connectedUsers.contains(callee)) {
            System.err.println("❌ Usuario no disponible");
            return ""; // ✅ Retorna vacío si no está conectado
        }

        String callId = UUID.randomUUID().toString();
        String timestamp = getCurrentTimestamp();

        CallInfo callInfo = new CallInfo();
        callInfo.callId = callId;
        callInfo.caller = caller;
        callInfo.callee = callee;
        callInfo.isActive = true;
        callInfo.timestamp = timestamp;

        activeCalls.put(callId, callInfo);

        MessageHistory.savePrivateMessage(
                caller,
                callee,
                "[CALL START] " + timestamp);

        subject.notifyIncomingCall(callee, callInfo);

        System.out.println("✅ Llamada iniciada, ID: " + callId);
        return callId;
    }

    @Override
    public boolean answerCall(String callId, boolean accepted, Current current) {
        System.out.println("📞 Respuesta: " + callId + " | " + (accepted ? "Aceptada" : "Rechazada"));

        CallInfo callInfo = activeCalls.get(callId);
        if (callInfo == null) {
            System.err.println("❌ Llamada no existe");
            return false;
        }

        subject.notifyCallAnswered(callInfo.caller, callId, accepted);

        if (!accepted) {
            activeCalls.remove(callId);
        }

        System.out.println("✅ Respuesta enviada en tiempo real");
        return true;
    }

    @Override
    public void streamCallAudio(String callId, String sender, byte[] chunk, Current current) {
        CallInfo callInfo = activeCalls.get(callId);
        if (callInfo == null || !callInfo.isActive) {
            return;
        }

        String recipient;
        if (sender.equals(callInfo.caller)) {
            recipient = callInfo.callee;
        } else if (sender.equals(callInfo.callee)) {
            recipient = callInfo.caller;
        } else {
            return;
        }

        subject.notifyCallAudioChunk(recipient, callId, sender, chunk);
    }

    @Override
    public boolean endCall(String callId, Current current) {
        System.out.println("📞 Terminando llamada: " + callId);

        CallInfo callInfo = activeCalls.remove(callId);
        if (callInfo == null) {
            System.err.println("❌ Llamada no existe");
            return false;
        }

        String timestamp = getCurrentTimestamp();
        MessageHistory.savePrivateMessage(
                callInfo.caller,
                callInfo.callee,
                "[CALL END] " + timestamp);

        subject.notifyCallEnded(callInfo.caller, callId);
        subject.notifyCallEnded(callInfo.callee, callId);

        System.out.println("✅ Llamada terminada");
        return true;
    }

    private String getCurrentTimestamp() {
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date());
    }

    @Override
    public byte[] getAudioFromHistory(String fileName, Current current) {
        File f = new File("src/audio_history", fileName);
        if (!f.exists()) {
            System.err.println("Archivo de audio no encontrado: " + fileName);
            return new byte[0];
        }
        try {
            return java.nio.file.Files.readAllBytes(f.toPath());
        } catch (IOException e) {
            System.err.println("Error leyendo audio de historial: " + e.getMessage());
            return new byte[0];
        }
    }

}
