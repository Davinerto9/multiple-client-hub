module ChatApp {
    sequence<byte> AudioData;
    sequence<string> StringSeq;
    
    struct TextMessage {
        string sender;
        string content;
        string timestamp;
    };
    
    sequence<TextMessage> MessageSeq;
    
    struct AudioMetadata {
        string sender;
        string timestamp;
        long size;
    };
    
    struct CallInfo {
        string callId;
        string caller;
        string callee;
        bool isActive;
        string timestamp;
    };
    
    struct GroupInfo {
        string name;
        StringSeq members;
    };
    
    sequence<GroupInfo> GroupSeq;
    
    // ==================== OBSERVER (Cliente - RECIBE CALLBACKS) ====================
    
    interface ChatObserver {
        // MENSAJES EN TIEMPO REAL
        void onPrivateMessage(string sender, string message, string timestamp);
        void onGroupMessage(string sender, string groupName, string message, string timestamp);
        
        // AUDIO EN TIEMPO REAL
        void onVoiceNoteReceived(string sender, AudioMetadata metadata, AudioData data);
        void onGroupVoiceNote(string sender, string groupName, AudioMetadata metadata, AudioData data);
        
        // LLAMADAS EN TIEMPO REAL
        void onIncomingCall(CallInfo callInfo);
        void onCallAnswered(string callId, bool accepted);
        void onCallAudioChunk(string callId, string sender, AudioData chunk);
        void onCallEnded(string callId);
        
        // NOTIFICACIONES DE USUARIOS EN TIEMPO REAL
        void onUserConnected(string username);
        void onUserDisconnected(string username);
        
        // NOTIFICACIONES DE GRUPOS EN TIEMPO REAL
        void onGroupCreated(string groupName, StringSeq members);
        void onGroupDeleted(string groupName);
    };
    
    // ==================== SUBJECT (Servidor - MANEJA OBSERVERS) ====================
    
    interface Subject {
        void attachObserver(string username, ChatObserver* observer);
        void deAttachObserver(string username);
    };
    
    // ==================== CHAT SERVICE (Servidor - API) ====================
    
    interface ChatService {
        // === ENVÍO DE MENSAJES ===
        bool sendPrivateMessage(string sender, string recipient, string message);
        bool sendGroupMessage(string sender, string groupName, string message);
        
        // === GESTIÓN DE GRUPOS ===
        bool createGroup(string groupName, StringSeq members);
        bool deleteGroup(string groupName);
        bool addMemberToGroup(string groupName, string username);
        bool removeMemberFromGroup(string groupName, string username);
        
        // === AUDIO ===
        bool sendVoiceNote(string sender, string recipient, AudioMetadata metadata, AudioData data);
        bool sendGroupVoiceNote(string sender, string groupName, AudioData data);
        AudioData getAudioFromHistory(string fileName);
        
        // === LLAMADAS ===
        string initiateCall(string caller, string callee);
        bool answerCall(string callId, bool accept);
        void streamCallAudio(string callId, string sender, AudioData chunk);
        bool endCall(string callId);

        // === GESTIÓN DE HISTORIAL ===
        void clearPrivateHistory(string user1, string user2);
        void clearGroupHistory(string groupName);
        
        // === CONSULTAS (HISTORIAL Y ESTADO) ===
        StringSeq getConnectedUsers();
        GroupSeq getAllGroups();
        MessageSeq getPrivateHistory(string user1, string user2);
        MessageSeq getGroupHistory(string groupName);
    };
};
