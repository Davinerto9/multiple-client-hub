module ChatApp {

    struct TextMessage {
        string sender;
        string receiver;
        string content;
        long timestamp;
        bool isGroup;
    };

    struct AudioChunk {
        string sender;
        string receiver;
        bool isGroup;
        int index;
        bool last;
        byte[] data;
        long timestamp;
    };

    struct GroupInfo {
        string name;
        string[] members;
    };

    interface ClientCallback {
        void onTextMessage(TextMessage msg);
        void onAudioChunk(AudioChunk chunk);
        void onIncomingCall(string fromUser);
        void onCallAccepted(string fromUser);
        void onCallRejected(string fromUser);
        void onGroupCreated(GroupInfo group);
    };

    interface ChatService {
        bool login(string username, ClientCallback* cb);
        void sendPrivateMessage(string sender, string receiver, string content);
        bool createGroup(string creator, string groupName, string[] members);
        void sendGroupMessage(string sender, string groupName, string content);
        TextMessage[] getPrivateHistory(string user1, string user2);
        TextMessage[] getGroupHistory(string groupName);
    };

    interface AudioService {
        void sendPrivateAudioChunk(AudioChunk chunk);
        void sendGroupAudioChunk(AudioChunk chunk);
    };

    interface CallService {
        void requestCall(string caller, string callee);
        void acceptCall(string caller, string callee);
        void rejectCall(string caller, string callee);
    };
};