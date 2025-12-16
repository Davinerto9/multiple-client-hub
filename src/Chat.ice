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

    interface ChatObserver {
        void onPrivateMessage(string sender, string message, string timestamp);
        void onGroupMessage(string sender, string groupName, string message, string timestamp);
        void onVoiceNoteReceived(string sender, AudioMetadata metadata, AudioData data);
        void onGroupVoiceNote(string sender, string groupName, AudioMetadata metadata, AudioData data);
        void onIncomingCall(CallInfo callInfo);
        void onCallAnswered(string callId, bool accepted);
        void onCallAudioChunk(string callId, string sender, AudioData chunk);
        void onCallEnded(string callId);
        void onUserConnected(string username);
        void onUserDisconnected(string username);
        void onGroupCreated(string groupName, StringSeq members);
        void onGroupDeleted(string groupName);
    };
    
    exception UserAlreadyConnectedException {
        string username;
        string reason;
    };

    interface Subject {
        void attachObserver(string username, ChatObserver* observer) throws UserAlreadyConnectedException;
        void deAttachObserver(string username);
    };
    
    interface ChatService {
        bool sendPrivateMessage(string sender, string recipient, string message);
        bool sendGroupMessage(string sender, string groupName, string message);
        bool createGroup(string groupName, StringSeq members);
        bool deleteGroup(string groupName);
        bool addMemberToGroup(string groupName, string username);
        bool removeMemberFromGroup(string groupName, string username);
        bool sendVoiceNote(string sender, string recipient, AudioMetadata metadata, AudioData data);
        bool sendGroupVoiceNote(string sender, string groupName, AudioData data);
        AudioData getAudioFromHistory(string fileName);
        string initiateCall(string caller, string callee);
        bool answerCall(string callId, bool accept);
        void streamCallAudio(string callId, string sender, AudioData chunk);
        bool endCall(string callId);
        void clearPrivateHistory(string user1, string user2);
        void clearGroupHistory(string groupName);
        StringSeq getConnectedUsers();
        GroupSeq getAllGroups();
        MessageSeq getPrivateHistory(string user1, string user2);
        MessageSeq getGroupHistory(string groupName);
    };
};
