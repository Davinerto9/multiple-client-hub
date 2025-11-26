class chatService {
    constructor() {
        this.communicator = null;
        this.chatServicePrx = null;
        this.subjectPrx = null;
        this.observerAdapter = null;
        this.currentUser = null;
        this.callbacks = {};
    }

    async initialize(username, callbacks) {
        this.currentUser = username;
        this.callbacks = callbacks;

        try {
            console.log('═══════════════════════════════════════════');
            console.log('🔌 Conectando el Servicio:', username);

            if (!window.Ice) throw new Error('Ice.js no está cargado');
            if (!window.ChatApp) throw new Error('Chat.js no está cargado');

            // Limpiar conexión anterior
            if (this.communicator) {
                try {
                    await this.communicator.destroy();
                } catch (e) {
                    console.warn('⚠️ Error limpiando:', e);
                }
            }

            // Configurar Ice en el navegador con ACM cliente desactivado
            const initData = new Ice.InitializationData();
            initData.properties = Ice.createProperties();

            // Desactivar Active Connection Management en el cliente
            // (la conexión no se cerrará por estar ociosa)
            initData.properties.setProperty('Ice.ACM.Client', '0');

            this.communicator = Ice.initialize(initData);
            console.log('Comunicador creado con ACM.Client=0');


            const hostname = '192.168.18.183';
            const port = 12345;

            const serviceProxy = this.communicator.stringToProxy(
                `ChatService:ws -h ${hostname} -p ${port}`
            );
            this.chatServicePrx = await ChatApp.ChatServicePrx.checkedCast(serviceProxy);

            if (!this.chatServicePrx) {
                throw new Error("No se pudo conectar a ChatService");
            }
            console.log('ChatService conectado');

            // ═══════════════════════════════════════════════════════════
            // PASO 3: Conectar al Subject (PATRÓN OBSERVER)
            // ═══════════════════════════════════════════════════════════
            const subjectProxy = this.communicator.stringToProxy(
                `Subject:ws -h ${hostname} -p ${port}`
            );
            this.subjectPrx = await ChatApp.SubjectPrx.checkedCast(subjectProxy);

            if (!this.subjectPrx) {
                throw new Error("No se pudo conectar a Subject");
            }
            console.log('Subject conectado');

            // ═══════════════════════════════════════════════════════════
            // PASO 4: Crear adapter y registrar observer (IGUAL QUE EL EJEMPLO)
            // ═══════════════════════════════════════════════════════════
            this.observerAdapter = await this.communicator.createObjectAdapter('');

            // Obtener conexión del Subject y asociar el adapter
            const conn = this.subjectPrx.ice_getCachedConnection();
            conn.setAdapter(this.observerAdapter);

            // Crear el observer servant
            const observerServant = new ChatObserverI(this.callbacks);

            // Registrar el observer con UUID
            const observerPrx = ChatApp.ChatObserverPrx.uncheckedCast(
                this.observerAdapter.addWithUUID(observerServant)
            );

            console.log('Observer creado');

            // ═══════════════════════════════════════════════════════════
            // PASO 5: Registrar el observer en el Subject
            // ═══════════════════════════════════════════════════════════
            await this.subjectPrx.attachObserver(username, observerPrx);
            console.log('Observer registrado en Subject');

            console.log('═══════════════════════════════════════════');
            console.log('Conexión Ice completada - CALLBACKS ACTIVOS');
            console.log('═══════════════════════════════════════════');

            return true;

        } catch (error) {
            console.error('Error Ice:', error.message);
            console.error('Stack:', error.stack);

            this.chatServicePrx = null;
            this.subjectPrx = null;
            this.observerAdapter = null;
            this.communicator = null;

            throw error;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // MÉTODOS DE COMUNICACIÓN
    // ═══════════════════════════════════════════════════════════════

    async ensureConnected() {
        if (!this.chatServicePrx) {
            console.warn('No hay proxy de ChatService, intentando reconectar...');
            await this.reconnect();
            return;
        }

        try {
            // ping ligero para validar la conexión
            await this.chatServicePrx.ice_ping();
        } catch (e) {
            console.warn('Conexión Ice perdida, intentando reconectar...', e);
            await this.reconnect();
        }
    }

    async reconnect() {
        if (!this.currentUser) {
            throw new Error('No hay usuario para reconectar');
        }
        if (!this.callbacks) {
            throw new Error('No hay callbacks registrados para reconectar');
        }

        // NO destruyas communicator aquí; initialize ya limpia lo anterior
        console.log('Re-conectando Ice para:', this.currentUser);
        const ok = await this.initialize(this.currentUser, this.callbacks);
        if (!ok) {
            throw new Error('No se pudo reconectar a Ice');
        }
    }

    async sendPrivateMessage(recipient, message) {
        try {
            await this.ensureConnected();

            console.log('Enviando mensaje privado a:', recipient);
            console.log('Mensaje:', message);

            const success = await this.chatServicePrx.sendPrivateMessage(
                this.currentUser,
                recipient,
                message
            );

            console.log('   Resultado:', success ? 'Enviado' : 'Falló');

            return { status: success ? 'ok' : 'error' };

        } catch (error) {
            console.error('Error enviando mensaje:', error);
            return { status: 'error', message: error.message };
        }
    }

    async sendGroupMessage(groupName, message) {
        try {
            await this.ensureConnected();

            console.log('Enviando mensaje grupal a:', groupName);

            const success = await this.chatServicePrx.sendGroupMessage(
                this.currentUser,
                groupName,
                message
            );

            return { status: success ? 'ok' : 'error' };

        } catch (error) {
            console.error('Error enviando mensaje grupal:', error);
            return { status: 'error', message: error.message };
        }
    }

    async sendVoiceNote(recipient, audioBlob) {
        try {
            await this.ensureConnected();

            console.log('Enviando nota de voz a:', recipient);
            console.log('Tamaño del blob:', audioBlob.size);

            // Convertir Blob a ArrayBuffer
            const arrayBuffer = await audioBlob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            console.log('   Datos convertidos:', uint8Array.length, 'bytes');

            // Crear metadata
            const metadata = new ChatApp.AudioMetadata();
            metadata.sender = this.currentUser;
            metadata.timestamp = new Date().toLocaleTimeString();
            metadata.size = uint8Array.length;

            const success = await this.chatServicePrx.sendVoiceNote(
                this.currentUser,
                recipient,
                metadata,
                uint8Array
            );

            console.log('Resultado:', success ? 'Enviado' : 'Falló');

            return success;

        } catch (error) {
            console.error('Error enviando nota de voz:', error);
            throw error;
        }
    }

    async sendGroupVoiceNote(groupName, audioBlob) {
        try {
            await this.ensureConnected();

            console.log('Enviando nota de voz grupal a:', groupName);
            console.log('Tamaño del blob:', audioBlob.size);

            // Convertir Blob a ArrayBuffer
            const arrayBuffer = await audioBlob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            console.log('   Datos convertidos (grupo):', uint8Array.length, 'bytes');

            const success = await this.chatServicePrx.sendGroupVoiceNote(
                this.currentUser,   // sender
                groupName,          // nombre del grupo
                uint8Array          // sequence<byte>
            );

            console.log('   Resultado grupal:', success ? 'Enviado' : 'Falló');
            return success;
        } catch (error) {
            console.error('Error enviando nota de voz grupal:', error);
            throw error;
        }
    }


    async initiateCall(callee) {
        try {
            await this.ensureConnected();

            console.log('Iniciando llamada a:', callee);

            const callId = await this.chatServicePrx.initiateCall(
                this.currentUser,
                callee
            );

            if (!callId || callId === '') {
                console.error('El usuario no está disponible para llamada');
                throw new Error('El usuario no está disponible o no está conectado');
            }

            console.log('CallId obtenido:', callId);

            return callId;

        } catch (error) {
            console.error('Error iniciando llamada:', error);
            throw error;
        }
    }

    async answerCall(callId, accepted) {
        try {
            await this.ensureConnected();

            console.log('Respondiendo llamada:', callId, '|', accepted ? 'Aceptar' : 'Rechazar');

            const success = await this.chatServicePrx.answerCall(callId, accepted);

            return success;

        } catch (error) {
            console.error('Error respondiendo llamada:', error);
            throw error;
        }
    }

    async endCall(callId) {
        try {
            await this.ensureConnected();

            console.log('Terminando llamada:', callId);

            const success = await this.chatServicePrx.endCall(callId);

            return success;

        } catch (error) {
            console.error('Error terminando llamada:', error);
            throw error;
        }
    }

    async streamCallAudio(callId, uint8Array) {
        try {
            await this.ensureConnected();

            console.log('Enviando chunk de audio de llamada:', callId, '| bytes:', uint8Array.length);

            await this.chatServicePrx.streamCallAudio(
                callId,
                this.currentUser,
                uint8Array
            );
        } catch (error) {
            console.error('Error enviando audio de llamada:', error);
        }
    }

    async getConnectedUsers() {
        try {
            await this.ensureConnected();

            console.log('Obteniendo usuarios conectados...');

            const users = await this.chatServicePrx.getConnectedUsers();

            console.log('   Usuarios:', users);

            return users;

        } catch (error) {
            console.error('Error obteniendo usuarios:', error);
            return [];
        }
    }

    async getPrivateHistory(user1, user2) {
        try {
            await this.ensureConnected();

            console.log('Cargando historial:', user1, '<->', user2);

            const history = await this.chatServicePrx.getPrivateHistory(user1, user2);

            console.log('Mensajes:', history.length);

            return history;

        } catch (error) {
            console.error('Error cargando historial:', error);
            return [];
        }
    }

    async getGroupHistory(groupName) {
        try {
            await this.ensureConnected();

            console.log('Cargando historial grupal:', groupName);

            const history = await this.chatServicePrx.getGroupHistory(groupName);

            return history;

        } catch (error) {
            console.error('Error cargando historial grupal:', error);
            return [];
        }
    }

    async getAudioFromHistory(fileName) {
        try {
            await this.ensureConnected();

            console.log('Cargando audio de historial:', fileName);

            // Llama a la operación del proxy ICE
            const bytes = await this.chatServicePrx.getAudioFromHistory(fileName);

            // bytes es un sequence<byte> generado por slice2js
            console.log('Bytes recibidos:', bytes ? bytes.length : 0);
            return bytes || [];
        } catch (error) {
            console.error('Error obteniendo audio de historial:', error);
            return [];
        }
    }


    async createGroup(groupName, members) {
        try {
            await this.ensureConnected();

            const membersArray = typeof members === 'string'
                ? members.split(',').map(m => m.trim())
                : members;

            console.log('Creando grupo:', groupName);
            console.log('Miembros:', membersArray);

            const result = await this.chatServicePrx.createGroup(groupName, membersArray);

            console.log('Resultado backend:', result);

            if (!result) {
                // El servidor rechazó la creación
                throw new Error(
                    'Group could not be created. ' +
                    'Check that all members exist, are connected and there are at least 2.'
                );
            }

            // Solo aquí consideramos que el grupo se creó
            return { status: 'ok', members: membersArray };

        } catch (error) {
            console.error('Error creando grupo:', error);

            let errorMessage = error.message || 'Unknown error';
            if (error.ice_name && error.ice_name === 'Ice::UnknownUserException') {
                errorMessage = error.unknown || errorMessage;
            }

            return {
                status: 'error',
                message: errorMessage
            };
        }
    }


    async deleteGroup(groupName) {
        try {
            await this.ensureConnected();

            console.log('Eliminando grupo:', groupName);

            const result = await this.chatServicePrx.deleteGroup(groupName);

            return { status: result ? 'ok' : 'error' };

        } catch (error) {
            console.error('Error eliminando grupo:', error);
            return { status: 'error', message: error.message };
        }
    }

    async addMemberToGroup(groupName, member) {
        try {
            await this.ensureConnected();

            console.log('Añadiendo miembro al grupo:', groupName, '|', member);

            const result = await this.chatServicePrx.addMemberToGroup(groupName, member);

            return { status: result ? 'ok' : 'error' };
        } catch (error) {
            console.error('Error agregando miembro al grupo:', error);
            return { status: 'error', message: error.message };
        }
    }

    async removeMemberFromGroup(groupName, member) {
        try {
            await this.ensureConnected();

            console.log('Removiendo miembro del grupo:', groupName, '|', member);

            const result = await this.chatServicePrx.removeMemberFromGroup(groupName, member);

            return { status: result ? 'ok' : 'error' };
        } catch (error) {
            console.error('Error removiendo miembro del grupo:', error);
            return { status: 'error', message: error.message };
        }
    }

    async clearPrivateHistory(user1, user2) {
        try {
            await this.ensureConnected();
            await this.chatServicePrx.clearPrivateHistory(user1, user2);
            return { status: 'ok' };
        } catch (error) {
            console.error('Error limpiando historial privado:', error);
            return { status: 'error', message: error.message };
        }
    }

    async clearGroupHistory(groupName) {
        try {
            await this.ensureConnected();
            await this.chatServicePrx.clearGroupHistory(groupName);
            return { status: 'ok' };
        } catch (error) {
            console.error('Error limpiando historial de grupo:', error);
            return { status: 'error', message: error.message };
        }
    }

    async getAllGroups() {
        try {
            await this.ensureConnected();

            console.log('Obteniendo grupos...');

            const groups = await this.chatServicePrx.getAllGroups();

            console.log('Grupos:', groups.length);

            return groups;

        } catch (error) {
            console.error('Error obteniendo grupos:', error);
            return [];
        }
    }

    async shutdown() {
        console.log('Cerrando conexión Ice...');

        if (this.subjectPrx && this.currentUser) {
            try {
                await this.subjectPrx.deAttachObserver(this.currentUser);
                console.log('Observer desregistrado');
            } catch (e) {
                console.warn('Error desregistering observer:', e);
            }
        }

        if (this.observerAdapter) {
            try {
                await this.observerAdapter.destroy();
                console.log('Adaptador destruido');
            } catch (e) {
                console.warn('Error destroying adapter:', e);
            }
        }

        if (this.communicator) {
            try {
                await this.communicator.destroy();
                console.log('Comunicador destruido');
            } catch (e) {
                console.warn('Error destroying communicator:', e);
            }
        }

        this.chatServicePrx = null;
        this.subjectPrx = null;
        this.observerAdapter = null;
        this.communicator = null;
        this.currentUser = null;
        this.callbacks = null;
    }
}


// ═══════════════════════════════════════════════════════════════
// OBSERVER (RECIBE CALLBACKS EN TIEMPO REAL)
// ═══════════════════════════════════════════════════════════════

class ChatObserverI extends ChatApp.ChatObserver {
    constructor(callbacks) {
        super();
        this.callbacks = callbacks;
        console.log('═══════════════════════════════════════════');
        console.log('🎯 ChatObserver CREADO');
        console.log('   Callbacks registrados:', Object.keys(callbacks));
        console.log('═══════════════════════════════════════════');
    }

    onPrivateMessage(sender, message, timestamp, current) {
        console.log('🔔 CALLBACK: onPrivateMessage');
        console.log('   Sender:', sender);
        console.log('   Message:', message);

        if (this.callbacks.onMessage) {
            this.callbacks.onMessage({
                type: 'private',
                sender: sender,
                content: message,
                timestamp: timestamp
            });
        }
    }

    onGroupMessage(sender, groupName, message, timestamp, current) {
        console.log('🔔 CALLBACK: onGroupMessage');
        console.log('   Group:', groupName);
        console.log('   Sender:', sender);

        if (this.callbacks.onMessage) {
            this.callbacks.onMessage({
                type: 'group',
                sender: sender,
                groupName: groupName,
                content: message,
                timestamp: timestamp
            });
        }
    }

    onVoiceNoteReceived(sender, metadata, data, current) {
        console.log('🔔 CALLBACK: onVoiceNoteReceived');
        console.log('   Sender:', sender);
        console.log('   Size:', data.length, 'bytes');

        if (this.callbacks.onVoiceNote) {
            try {
                const uint8Array = new Uint8Array(data);
                const audioBlob = new Blob([uint8Array], { type: 'audio/webm' });

                this.callbacks.onVoiceNote({
                    type: 'private',
                    sender: sender,
                    audioBlob: audioBlob,
                    timestamp: metadata.timestamp
                });
            } catch (error) {
                console.error('❌ Error procesando audio:', error);
            }
        }
    }

    onGroupVoiceNote(sender, groupName, metadata, data, current) {
        console.log('🔔 CALLBACK: onGroupVoiceNote');
        console.log('   Group:', groupName);
        console.log('   Sender:', sender);
        console.log('   Size:', data.length, 'bytes');

        if (this.callbacks.onVoiceNote) {
            try {
                const uint8Array = new Uint8Array(data);
                const audioBlob = new Blob([uint8Array], { type: 'audio/webm' });

                this.callbacks.onVoiceNote({
                    type: 'group',
                    groupName: groupName,
                    sender: sender,
                    audioBlob: audioBlob,
                    timestamp: metadata.timestamp
                });
            } catch (error) {
                console.error('❌ Error procesando audio grupal:', error);
            }
        }
    }


    onIncomingCall(callInfo, current) {
        console.log('🔔 CALLBACK: onIncomingCall');
        console.log('   CallId:', callInfo.callId);
        console.log('   Caller:', callInfo.caller);

        if (this.callbacks.onCall) {
            this.callbacks.onCall({
                type: 'incoming',
                callInfo: callInfo
            });
        }
    }

    onCallAnswered(callId, accepted, current) {
        console.log('🔔 CALLBACK: onCallAnswered');
        console.log('   CallId:', callId);
        console.log('   Accepted:', accepted);

        if (this.callbacks.onCall) {
            this.callbacks.onCall({
                type: 'answered',
                callId: callId,
                accepted: accepted
            });
        }
    }

    onCallAudioChunk(callId, sender, chunk, current) {
        console.log('🔔 CALLBACK: onCallAudioChunk');
        console.log('   CallId:', callId);
        console.log('   Sender:', sender);
        console.log('   Bytes:', chunk.length);

        try {
            const uint8Array = new Uint8Array(chunk);

            if (this.callbacks.onCall) {
                this.callbacks.onCall({
                    type: 'audioChunk',
                    callId,
                    sender,
                    chunk: uint8Array   // <- PCM crudo
                });
            }
        } catch (e) {
            console.error('❌ Error procesando audio de llamada (PCM):', e);
        }
    }


    onCallEnded(callId, current) {
        console.log('🔔 CALLBACK: onCallEnded');
        console.log('   CallId:', callId);

        if (this.callbacks.onCall) {
            this.callbacks.onCall({
                type: 'ended',
                callId: callId
            });
        }
    }

    onUserConnected(username, current) {
        console.log('🔔 CALLBACK: onUserConnected');
        console.log('   Username:', username);

        if (this.callbacks.onUserStatus) {
            this.callbacks.onUserStatus({
                username: username,
                online: true
            });
        }
    }

    onUserDisconnected(username, current) {
        console.log('🔔 CALLBACK: onUserDisconnected');
        console.log('   Username:', username);

        if (this.callbacks.onUserStatus) {
            this.callbacks.onUserStatus({
                username: username,
                online: false
            });
        }
    }

    onGroupCreated(groupName, members, current) {
        console.log('🔔 CALLBACK: onGroupCreated');
        console.log('   Group:', groupName);
        console.log('   Members:', members);

        if (this.callbacks.onGroupUpdate) {
            this.callbacks.onGroupUpdate({
                type: 'created',
                groupName: groupName,
                members: members
            });
        }
    }

    onGroupDeleted(groupName, current) {
        console.log('🔔 CALLBACK: onGroupDeleted');
        console.log('   Group:', groupName);

        if (this.callbacks.onGroupUpdate) {
            this.callbacks.onGroupUpdate({
                type: 'deleted',
                groupName: groupName
            });
        }
    }

}

const ChatService = new chatService();
window.ChatService = ChatService;
console.log('ChatService cargado');


