package com.icesi.chatapp.Server;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import java.io.*;
import java.net.Socket;
import java.util.*;

public class ClientHandler implements Runnable {

    static class ApiCommand {
    String op;
    String creator;
    String groupName;
    String from;
    String to;
    String group;
    String message;
    String u1;
    String u2;
}
private boolean apiSession = false;
private static final Gson gson = new Gson();
private void sendEvent(String type, Map<String,Object> data) {
    if (!apiSession) return;
    Map<String,Object> evt = new HashMap<>();
    evt.put("type", type);
    evt.put("data", data);
    writeJson(evt);
}

private void writeJson(Object obj) {
    out.println(gson.toJson(obj));
    out.flush();
}
    private Socket clientSocket;
    private String clientName;
    private BufferedReader in;
    private PrintWriter out;

    // Usuarios conectados: nombre -> ClientHandler
    private static final Map<String, ClientHandler> users = Collections.synchronizedMap(new HashMap<>());

    // Grupos: nombre grupo -> conjunto de ClientHandler miembros
    private static final Map<String, Set<ClientHandler>> groups = Collections.synchronizedMap(new HashMap<>());

    private DataInputStream dataIn;
    private DataOutputStream dataOut;

    public ClientHandler(Socket socket) throws IOException {
        this.clientSocket = socket;
        this.in = new BufferedReader(new InputStreamReader(clientSocket.getInputStream()));
        this.out = new PrintWriter(clientSocket.getOutputStream(), true);
        this.dataIn = new DataInputStream(clientSocket.getInputStream());
        this.dataOut = new DataOutputStream(clientSocket.getOutputStream());
        
        // Crear directorio para audios del servidor si no existe
        new File("server_audios").mkdirs();
    }

@Override
public void run() {
    try {
        try {
            // === Detección de modo API ===
            clientSocket.setSoTimeout(200);
            String first = in.readLine();
            clientSocket.setSoTimeout(0);

            if (first != null) {
                // ❶ Sesión persistente para frontend (WebSocket via proxy)
                if (first.startsWith("API_SESSION ")) {
                    Map<String, String> open = gson.fromJson(
                            first.substring(12),
                            new com.google.gson.reflect.TypeToken<Map<String,String>>(){}.getType()
                    );
                    String name = open.get("name");
                    if (name == null || name.trim().isEmpty()) {
                        writeJson(Map.of("ok", false, "error", "name requerido"));
                        clientSocket.close();
                        return;
                    }

                    this.clientName = name.trim();
                    synchronized (users) {
                        if (users.containsKey(clientName)) {
                            writeJson(Map.of("ok", false, "error", "Nombre ya en uso"));
                            clientSocket.close();
                            return;
                        }
                        users.put(clientName, this);
                    }

                    // marca que este handler es una sesión API persistente
                    this.apiSession = true;
                    writeJson(Map.of("ok", true, "type", "hello", "name", clientName));

                    // Bucle de comandos JSON línea a línea hasta que el cliente cierre
                    String line;
                    while ((line = in.readLine()) != null) {
                        handleApi(line); // ahora recibe JSON puro por línea
                    }
                    return; // al salir del bucle, cerrará en finally
                }

                // ❷ Modo API “one-shot” (tu modo anterior)
                if (first.startsWith("API ")) {
                    handleApi(first.substring(4)); // quita "API "
                    clientSocket.close();
                    return;
                }
            }
        } catch (java.net.SocketTimeoutException ignore) {
            // No llegó nada aún → continuamos a modo interactivo
            clientSocket.setSoTimeout(0);
        }

        // === ❸ Modo interactivo por consola (sin cambios en lógica) ===
        out.println("Ingresa tu nombre:");
        clientName = in.readLine();

        synchronized (users) {
            if (users.containsKey(clientName)) {
                out.println("Nombre ya en uso. Conexión terminada.");
                clientSocket.close();
                return;
            }
            users.put(clientName, this);
        }

        out.println("¡Hola " + clientName + "!");

        String opcion;
        while (true) {
            out.println("\nMENU:\n" +
                    "1. Enviar mensaje a usuario\n" +
                    "2. Crear grupo\n" +
                    "3. Enviar mensaje a grupo\n" +
                    "4. Salir\n" +
                    "5. Nota de voz privada\n" +
                    "6. Nota de voz a grupo\n" +
                    "7. Ver historial privado\n" +
                    "8. Ver historial de grupo\n" +
                    "9. Llamar a un usuario\n" +
                    "Elige opcion:");

            opcion = in.readLine();
            if (opcion == null || opcion.equals("4")) break;

            switch (opcion) {
                case "1": enviarPrivado(); break;
                case "2": crearGrupo(); break;
                case "3": enviarAGrupo(); break;
                case "5": manejarNotaVozPrivada(); break;
                case "6": manejarNotaVozGrupo(); break;
                case "7": verHistorialPrivado(); break;
                case "8": verHistorialGrupo(); break;
                case "9": manejarLlamada(); break;
                case "CALL_ACCEPTED": System.out.println("Llamada aceptada por: " + clientName); break;
                case "CALL_REJECTED": System.out.println("Llamada rechazada por: " + clientName); break;
                default: out.println("Opción no válida."); break;
            }
        }
    } catch (IOException e) {
        System.out.println("Error con el cliente " + clientName + ": " + e.getMessage());
    } finally {
        try {
            synchronized (users) { users.remove(clientName); }
            synchronized (groups) {
                for (Set<ClientHandler> grupo : groups.values()) { grupo.remove(this); }
            }
            clientSocket.close();
            System.out.println("Cliente " + clientName + " desconectado.");
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}

private void handleApi(String json) {
    try {
        ApiCommand cmd = gson.fromJson(json, ApiCommand.class);
        Map<String,Object> resp = new HashMap<>();
        resp.put("ok", true);

        switch (cmd.op) {
            case "create_group": {
                if (cmd.groupName == null || cmd.creator == null) {
                    resp.put("ok", false); resp.put("error", "Faltan campos");
                    writeJson(resp); return;
                }
                synchronized (groups) {
                    groups.putIfAbsent(cmd.groupName, Collections.synchronizedSet(new HashSet<>()));
                    // opcional: si el creador está conectado, lo agregamos
                    ClientHandler creador;
                    synchronized (users) { creador = users.get(cmd.creator); }
                    if (creador != null) { groups.get(cmd.groupName).add(creador); }
                }
                resp.put("msg", "Grupo creado: " + cmd.groupName);
                writeJson(resp);
                break;
            }
            case "send_user": {
                if (cmd.from == null || cmd.to == null || cmd.message == null) {
                    resp.put("ok", false); resp.put("error", "Faltan campos");
                    writeJson(resp); return;
                }
                ClientHandler receptor;
                synchronized (users) { receptor = users.get(cmd.to); }
                if (receptor != null && !cmd.to.equals(cmd.from)) {
                    // consola (cliente interactivo)
                    receptor.out.println("Mensaje privado de " + cmd.from + ": " + cmd.message);
                    // frontend (sesión API)
                    receptor.sendEvent("message", Map.of(
                    "kind", "private",
                    "from", cmd.from,
                    "to", cmd.to,
                    "text", cmd.message,
                    "ts", new java.util.Date().toString()
                    ));
                }

                MessageHistory.savePrivateMessage(cmd.from, cmd.to, cmd.message);
                Database.saveTextMessage("private", cmd.from, cmd.to, false, cmd.message);
                resp.put("msg", "Mensaje privado enviado/registrado");
                writeJson(resp);
                break;
            }
            case "send_group": {
                if (cmd.from == null || cmd.group == null || cmd.message == null) {
                    resp.put("ok", false); resp.put("error", "Faltan campos");
                    writeJson(resp); return;
                }
                synchronized (groups) {
                   Set<ClientHandler> miembros = groups.get(cmd.group);
                if (miembros != null) {
                    for (ClientHandler m : miembros) {
                        if (!m.clientName.equals(cmd.from)) {
                             // consola
                             m.out.println("[" + cmd.group + "] " + cmd.from + ": " + cmd.message);
                            // frontend
                             m.sendEvent("message", Map.of(
                                "kind", "group",
                                "group", cmd.group,
                                 "from",  cmd.from,
                                "text",  cmd.message,
                               "ts",    new java.util.Date().toString()
                               ));
                            }
                        }
                    }
                }
                MessageHistory.saveGroupMessage(cmd.from, cmd.group, cmd.message);
                Database.saveTextMessage("group", cmd.from, cmd.group, true, cmd.message);
                resp.put("msg", "Mensaje grupal enviado/registrado");
                writeJson(resp);
                break;
            }
            case "history_user": {
                if (cmd.u1 == null || cmd.u2 == null) {
                    resp.put("ok", false); resp.put("error", "Faltan campos");
                    writeJson(resp); return;
                }
                List<String> h = MessageHistory.getPrivateHistory(cmd.u1, cmd.u2);
                writeJson(h);
                break;
            }
            case "history_group": {
                if (cmd.group == null) {
                    resp.put("ok", false); resp.put("error", "Faltan campos");
                    writeJson(resp); return;
                }
                List<String> h = MessageHistory.getGroupHistory(cmd.group);
                writeJson(h);
                break;
            }
            default:
                resp.put("ok", false);
                resp.put("error", "Operación no soportada: " + cmd.op);
                writeJson(resp);
        }
    } catch (Exception e) {
        Map<String,Object> err = new HashMap<>();
        err.put("ok", false);
        err.put("error", e.getMessage());
        writeJson(err);
    }
}


    private void enviarPrivado() throws IOException {
        List<String> disponibles = new ArrayList<>();
        synchronized (users) {
            for (String nombre : users.keySet()) {
                if (!nombre.equals(this.clientName)) {
                    disponibles.add(nombre);
                }
            }
        }

        if (disponibles.isEmpty()) {
            out.println("No hay otros usuarios conectados en este momento.");
            return;
        }

        out.println("Usuarios disponibles:");
        for (String nombre : disponibles) {
            out.println(" - " + nombre);
        }

        out.println("¿A qué usuario deseas enviar el mensaje?");
        String destino = in.readLine();
        out.println("Escribe tu mensaje:");
        String mensaje = in.readLine();

        ClientHandler receptor;
        synchronized (users) {
            receptor = users.get(destino);
        }
        if (receptor != null && !destino.equals(clientName)) {
            receptor.out.println("Mensaje privado de " + clientName + ": " + mensaje);
            
            // Guardar en historial
            MessageHistory.savePrivateMessage(clientName, destino, mensaje);
            Database.saveTextMessage("private", clientName, destino, false, mensaje);
            
            out.println("Mensaje enviado correctamente.");
        } else {
            out.println("Usuario no encontrado o invalido.");
        }
    }

    private void crearGrupo() throws IOException {
        out.println("Nombre del grupo:");
        String nombreGrupo = in.readLine();

        synchronized (groups) {
            groups.putIfAbsent(nombreGrupo, Collections.synchronizedSet(new HashSet<>()));
            groups.get(nombreGrupo).add(this);
        }

        out.println("Grupo '" + nombreGrupo + "' creado.");
        out.println("Usuarios disponibles para agregar:");

        synchronized (users) {
            for (String nombre : users.keySet()) {
                if (!nombre.equals(this.clientName)) {
                    out.println(" - " + nombre);
                }
            }
        }

        out.println("Escribe los nombres de los usuarios a agregar, separados por comas:");
        String linea = in.readLine();
        if (linea == null || linea.trim().isEmpty()) return;

        String[] nombres = linea.split(",");

        synchronized (groups) {
            for (String nombre : nombres) {
                String limpio = nombre.trim();
                if (!limpio.equals(clientName)) {
                    ClientHandler ch;
                    synchronized (users) {
                        ch = users.get(limpio);
                    }
                    if (ch != null) {
                        groups.get(nombreGrupo).add(ch);
                        ch.out.println("Has sido agregado al grupo '" + nombreGrupo + "' por " + clientName + ".");
                    } else {
                        out.println("No se pudo agregar a '" + limpio + "' (no existe).");
                    }
                } else {
                    out.println("No se pudo agregar a '" + limpio + "' (es tu propio nombre).");
                }
            }
        }

        out.println("Miembros actuales del grupo '" + nombreGrupo + "':");
        synchronized (groups) {
            for (ClientHandler miembro : groups.get(nombreGrupo)) {
                out.println(" - " + miembro.clientName);
            }
        }
    }

    private void enviarAGrupo() throws IOException {
        if (groups.isEmpty()) {
            out.println("No hay grupos creados aun.");
            return;
        }

        out.println("Grupos disponibles:");
        synchronized (groups) {
            for (String nombreGrupo : groups.keySet()) {
                out.println(" - " + nombreGrupo);
            }
        }

        out.println("Nombre del grupo al que deseas enviar mensaje:");
        String grupo = in.readLine();

        synchronized (groups) {
            if (!groups.containsKey(grupo)) {
                out.println("Grupo no encontrado.");
                return;
            }
        }

        out.println("Escribe tu mensaje para el grupo:");
        String mensaje = in.readLine();

        synchronized (groups) {
            for (ClientHandler miembro : groups.get(grupo)) {
                if (!miembro.clientName.equals(this.clientName)) {
                    miembro.out.println("[" + grupo + "] " + clientName + ": " + mensaje);
                }
            }
        }
        
        // Guardar en historial
        MessageHistory.saveGroupMessage(clientName, grupo, mensaje);
        Database.saveTextMessage("group", clientName, grupo, true, mensaje);
        
        out.println("Mensaje enviado al grupo correctamente.");
    }

    private void manejarNotaVozPrivada() throws IOException {
        // Mostrar usuarios disponibles
        List<String> disponibles = new ArrayList<>();
        synchronized (users) {
            for (String nombre : users.keySet()) {
                if (!nombre.equals(this.clientName)) {
                    disponibles.add(nombre);
                }
            }
        }

        if (disponibles.isEmpty()) {
            out.println("No hay otros usuarios conectados.");
            return;
        }

        out.println("Usuarios disponibles:");
        for (String nombre : disponibles) {
            out.println(" - " + nombre);
        }
        out.flush(); // Asegurar que se envía inmediatamente

        // Esperar a que el cliente envíe el destinatario
        String destino = in.readLine();
        if (destino == null || destino.trim().isEmpty()) {
            out.println("Destinatario no valido.");
            return;
        }

        ClientHandler receptor;
        synchronized (users) {
            receptor = users.get(destino.trim());
        }

        if (receptor == null || destino.equals(clientName)) {
            out.println("Usuario no encontrado o invalido.");
            return;
        }

        try {
            // Recibir audio del cliente
            File audioRecibido = recibirArchivoAudio();
            
            if (audioRecibido == null || audioRecibido.length() == 0) {
                out.println("Error: Audio no recibido correctamente.");
                return;
            }

            // Reenviar audio al destinatario
            boolean enviado = enviarAudioACliente(receptor, audioRecibido, this.clientName);
            
            if (enviado) {
                // Guardar en historial
                MessageHistory.savePrivateAudio(this.clientName, destino, audioRecibido);
                Database.saveAudioRecord(this.clientName, destino, false, audioRecibido.getAbsolutePath());
                out.println("Nota de voz enviada correctamente a " + destino);
                System.out.println("Audio privado enviado de " + clientName + " a " + destino);
            } else {
                out.println("Error al enviar la nota de voz.");
            }

        } catch (IOException e) {
            out.println("Error al procesar la nota de voz: " + e.getMessage());
            System.err.println("Error procesando audio de " + clientName + ": " + e.getMessage());
        }
    }

    private void manejarNotaVozGrupo() throws IOException {
        if (groups.isEmpty()) {
            out.println("No hay grupos disponibles.");
            return;
        }

        // Mostrar grupos disponibles
        out.println("Grupos disponibles:");
        synchronized (groups) {
            for (String nombreGrupo : groups.keySet()) {
                out.println(" - " + nombreGrupo);
            }
        }
        out.flush(); // Asegurar que se envía inmediatamente

        // Esperar a que el cliente envíe el grupo
        String nombreGrupo = in.readLine();
        if (nombreGrupo == null || nombreGrupo.trim().isEmpty()) {
            out.println("Nombre de grupo no valido.");
            return;
        }

        Set<ClientHandler> miembros;
        synchronized (groups) {
            miembros = groups.get(nombreGrupo.trim());
        }

        if (miembros == null) {
            out.println("Grupo no encontrado.");
            return;
        }

        try {
            // Recibir audio del cliente
            File audioRecibido = recibirArchivoAudio();
            
            if (audioRecibido == null || audioRecibido.length() == 0) {
                out.println("Error: Audio no recibido correctamente.");
                return;
            }

            // Reenviar audio a todos los miembros del grupo
            int exitosos = 0;
            for (ClientHandler miembro : miembros) {
                if (!miembro.clientName.equals(this.clientName)) {
                    if (enviarAudioACliente(miembro, audioRecibido, this.clientName)) {
                        exitosos++;
                    }
                }
            }

            if (exitosos > 0) {
                // Guardar en historial
                MessageHistory.saveGroupAudio(this.clientName, nombreGrupo, audioRecibido);
                Database.saveAudioRecord(this.clientName, nombreGrupo, true, audioRecibido.getAbsolutePath());
                out.println("Nota de voz enviada correctamente al grupo " + nombreGrupo + " (" + exitosos + " miembros)");
                System.out.println("Audio grupal enviado de " + clientName + " al grupo " + nombreGrupo + " (" + exitosos + " receptores)");
            } else {
                out.println("No se pudo enviar la nota de voz a ningún miembro del grupo.");
            }

        } catch (IOException e) {
            out.println("Error al procesar la nota de voz: " + e.getMessage());
            System.err.println("Error procesando audio grupal de " + clientName + ": " + e.getMessage());
        }
    }

    private File recibirArchivoAudio() throws IOException {
        try {
            // Recibir información del archivo
            String nombreArchivo = dataIn.readUTF();
            long tamanoArchivo = dataIn.readLong();

            System.out.println("Recibiendo audio: " + nombreArchivo + " (" + tamanoArchivo + " bytes) de " + clientName);

            if (tamanoArchivo <= 0 || tamanoArchivo > 10000000) { // Límite de 10MB
                throw new IOException("Tamaño de archivo inválido: " + tamanoArchivo);
            }

            // Crear archivo en el servidor
            File carpetaAudios = new File("server_audios");
            if (!carpetaAudios.exists()) {
                carpetaAudios.mkdirs();
            }

            String nombreUnico = System.currentTimeMillis() + "_" + clientName + "_" + nombreArchivo;
            File archivoAudio = new File(carpetaAudios, nombreUnico);

            // Recibir datos del archivo
            try (FileOutputStream fos = new FileOutputStream(archivoAudio);
                 BufferedOutputStream bos = new BufferedOutputStream(fos)) {

                byte[] buffer = new byte[4096];
                long bytesRecibidos = 0;

                while (bytesRecibidos < tamanoArchivo) {
                    int bytesParaLeer = (int) Math.min(buffer.length, tamanoArchivo - bytesRecibidos);
                    int bytesLeidos = dataIn.read(buffer, 0, bytesParaLeer);

                    if (bytesLeidos == -1) {
                        throw new IOException("Conexión cerrada inesperadamente");
                    }

                    bos.write(buffer, 0, bytesLeidos);
                    bytesRecibidos += bytesLeidos;
                }
                bos.flush();
            }

            System.out.println("Audio recibido y guardado: " + archivoAudio.getPath() + " (" + archivoAudio.length() + " bytes)");
            return archivoAudio;

        } catch (IOException e) {
            System.err.println("Error recibiendo archivo de audio de " + clientName + ": " + e.getMessage());
            throw e;
        }
    }

    private boolean enviarAudioACliente(ClientHandler cliente, File audioFile, String emisor) {
        try {
            // Verificar que el archivo existe y no está vacío
            if (!audioFile.exists() || audioFile.length() == 0) {
                System.err.println("Archivo de audio inválido: " + audioFile.getPath());
                return false;
            }

            // Enviar señal de audio entrante
            cliente.out.println("AUDIO_INCOMING");
            cliente.out.flush();

            // Pequeña pausa para asegurar sincronización
            Thread.sleep(50);

            // Enviar información del audio
            cliente.dataOut.writeUTF(emisor);
            cliente.dataOut.writeUTF(audioFile.getName());
            cliente.dataOut.writeLong(audioFile.length());

            // Enviar contenido del archivo
            try (FileInputStream fis = new FileInputStream(audioFile);
                 BufferedInputStream bis = new BufferedInputStream(fis)) {
                
                byte[] buffer = new byte[4096];
                int bytesLeidos;
                long totalEnviado = 0;
                
                while ((bytesLeidos = bis.read(buffer)) > 0) {
                    cliente.dataOut.write(buffer, 0, bytesLeidos);
                    totalEnviado += bytesLeidos;
                }
                cliente.dataOut.flush();
                
                System.out.println("Audio enviado a " + cliente.clientName + ": " + audioFile.getName() + " (" + totalEnviado + " bytes)");
            }

            return true;

        } catch (Exception e) {
            System.err.println("Error enviando audio a " + cliente.clientName + ": " + e.getMessage());
            return false;
        }
    }

    private void verHistorialPrivado() throws IOException {
        List<String> disponibles = new ArrayList<>();
        synchronized (users) {
            for (String nombre : users.keySet()) {
                if (!nombre.equals(this.clientName)) {
                    disponibles.add(nombre);
                }
            }
        }

        if (disponibles.isEmpty()) {
            out.println("No hay otros usuarios para ver historial.");
            return;
        }

        out.println("Usuarios disponibles para ver historial:");
        for (String nombre : disponibles) {
            out.println(" - " + nombre);
        }

        out.println("¿De qué usuario quieres ver el historial?");
        String usuario = in.readLine();

        List<String> historial = MessageHistory.getPrivateHistory(clientName, usuario);
        
        if (historial.isEmpty()) {
            out.println("No hay historial con " + usuario);
        } else {
            out.println("=== HISTORIAL CON " + usuario.toUpperCase() + " ===");
            for (String linea : historial) {
                out.println(linea);
            }
            out.println("=== FIN DEL HISTORIAL ===");
        }
    }

    private void verHistorialGrupo() throws IOException {
        if (groups.isEmpty()) {
            out.println("No hay grupos disponibles.");
            return;
        }

        out.println("Grupos disponibles:");
        synchronized (groups) {
            for (String nombreGrupo : groups.keySet()) {
                out.println(" - " + nombreGrupo);
            }
        }

        out.println("¿De qué grupo quieres ver el historial?");
        String grupo = in.readLine();

        List<String> historial = MessageHistory.getGroupHistory(grupo);
        
        if (historial.isEmpty()) {
            out.println("No hay historial para el grupo " + grupo);
        } else {
            out.println("=== HISTORIAL DEL GRUPO " + grupo.toUpperCase() + " ===");
            for (String linea : historial) {
                out.println(linea);
            }
            out.println("=== FIN DEL HISTORIAL ===");
        }
    }

    // Métodos getter para acceder al clientName
    public String getClientName() {
        return clientName;
    }

    // Método para cerrar conexión
    public void cerrarConexion() {
        try {
            if (clientSocket != null && !clientSocket.isClosed()) {
                clientSocket.close();
            }
        } catch (IOException e) {
            System.err.println("Error al cerrar conexión: " + e.getMessage());
        }
    }

    private void manejarLlamada() throws IOException {
        // Mostrar usuarios disponibles
        List<String> disponibles = new ArrayList<>();
        synchronized (users) {
            for (String nombre : users.keySet()) {
                if (!nombre.equals(this.clientName)) {
                    disponibles.add(nombre);
                }
            }
        }

        if (disponibles.isEmpty()) {
            out.println("No hay otros usuarios conectados.");
            return;
        }

        out.println("Usuarios disponibles para llamar:");
        for (String nombre : disponibles) {
            out.println(" - " + nombre);
        }

        out.println("¿A qué usuario deseas llamar?");
        String destinatario = in.readLine();

        if (destinatario == null || !users.containsKey(destinatario)) {
            out.println("El usuario no está conectado.");
            return;
        }

        ClientHandler receptor = users.get(destinatario);

        try {
            // Informar al llamante
            String ipReceptor = receptor.clientSocket.getInetAddress().getHostAddress();
            int puertoBase = 15000; // Puerto base más alto para evitar conflictos

            out.println("IP_DESTINO:" + ipReceptor);
            out.println("PUERTO_DESTINO:" + puertoBase);



            // Notificar al receptor
            receptor.out.println("LLAMADA_INCOMING");
            receptor.dataOut.writeUTF(this.clientName);
            receptor.dataOut.writeUTF(ipReceptor);
            receptor.dataOut.writeInt(puertoBase);
            receptor.dataOut.flush();

            System.out.println("=== LLAMADA INICIADA ===");
            System.out.println("De: " + clientName + " → Para: " + destinatario);
            System.out.println("IP: " + ipReceptor + ", Puerto base: " + puertoBase);

            out.println("Llamada iniciada a " + destinatario + ". Esperando respuesta...");

        } catch (Exception e) {
            out.println("Error al iniciar la llamada: " + e.getMessage());
            System.err.println("Error en llamada de " + clientName + " a " + destinatario + ": " + e.getMessage());
            e.printStackTrace();
        }
    }



}