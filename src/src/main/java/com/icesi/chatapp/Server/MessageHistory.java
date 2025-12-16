package com.icesi.chatapp.Server;

import java.io.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import ChatApp.TextMessage;

public class MessageHistory {
    private static final String HISTORY_DIR = "src/chat_history";
    private static final String AUDIO_HISTORY_DIR = "src/audio_history";
    private static final DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    // Inicializar directorios
    static {
        new File(HISTORY_DIR).mkdirs();
        new File(AUDIO_HISTORY_DIR).mkdirs();
    }

    // Guardar mensaje de texto privado
    public static synchronized void savePrivateMessage(String sender, String receiver, String message) {
        String timestamp = LocalDateTime.now().format(formatter);
        String logEntry = String.format("[%s] %s -> %s: %s%n", timestamp, sender, receiver, message);

        // Guardar en archivo del emisor
        appendToFile(getPrivateHistoryFile(sender, receiver), logEntry);
    }

    // Guardar mensaje de texto grupal
    public static synchronized void saveGroupMessage(String sender, String groupName, String message) {
        String timestamp = LocalDateTime.now().format(formatter);
        String logEntry = String.format("[%s] %s en %s: %s%n", timestamp, sender, groupName, message);

        appendToFile(getGroupHistoryFile(groupName), logEntry);
    }

    // Guardar nota de voz privada
    public static synchronized void savePrivateAudio(String sender, String receiver, File audioFile) {
        String timestamp = LocalDateTime.now().format(formatter);

        // Copiar archivo de audio al historial
        File audioHistoryFile = copyAudioToHistory(audioFile, sender, receiver, timestamp, false);

        // Registrar en historial de texto
        String logEntry = String.format("[%s] %s -> %s: [AUDIO: %s]%n",
                timestamp, sender, receiver, audioHistoryFile.getName());

        appendToFile(getPrivateHistoryFile(sender, receiver), logEntry);
    }

    // Guardar nota de voz grupal
    public static synchronized void saveGroupAudio(String sender, String groupName, File audioFile) {
        String timestamp = LocalDateTime.now().format(formatter);

        // Copiar archivo de audio al historial
        File audioHistoryFile = copyAudioToHistory(audioFile, sender, groupName, timestamp, true);

        // Registrar en historial de texto
        String logEntry = String.format("[%s] %s en %s: [AUDIO: %s]%n",
                timestamp, sender, groupName, audioHistoryFile.getName());

        appendToFile(getGroupHistoryFile(groupName), logEntry);
    }

    // Obtener historial de conversación privada
    public static synchronized List<String> getPrivateHistory(String user1, String user2) {
        File historyFile = getPrivateHistoryFile(user1, user2);
        return readHistoryFromFile(historyFile);
    }

    // Obtener historial de grupo
    public static synchronized List<String> getGroupHistory(String groupName) {
        File historyFile = getGroupHistoryFile(groupName);
        return readHistoryFromFile(historyFile);
    }

    // Métodos auxiliares
    private static synchronized File getPrivateHistoryFile(String user1, String user2) {
        // Crear nombre consistente para la conversación (orden alfabético)
        List<String> users = Arrays.asList(user1, user2);
        Collections.sort(users);
        String fileName = "private_" + users.get(0) + "_" + users.get(1) + ".txt";
        return new File(HISTORY_DIR, fileName);
    }

    private static synchronized File getGroupHistoryFile(String groupName) {
        String fileName = "group_" + groupName + ".txt";
        return new File(HISTORY_DIR, fileName);
    }

    private static synchronized void appendToFile(File file, String content) {
        try (FileOutputStream fos = new FileOutputStream(file, true);
                BufferedWriter bw = new BufferedWriter(new OutputStreamWriter(fos))) {
            bw.write(content);
            bw.flush();

            fos.getFD().sync();
        } catch (IOException e) {
            System.err.println("Error al guardar en historial: " + e.getMessage());
        }
    }

    private static synchronized List<String> readHistoryFromFile(File file) {
        List<String> history = new ArrayList<>();
        if (!file.exists())
            return history;

        try (BufferedReader br = new BufferedReader(new FileReader(file))) {
            String line;
            while ((line = br.readLine()) != null) {
                history.add(line);
            }
        } catch (IOException e) {
            System.err.println("Error al leer historial: " + e.getMessage());
        }
        return history;
    }

    private static synchronized File copyAudioToHistory(File sourceAudio, String sender, String destination,
            String timestamp, boolean isGroup) {
        String cleanTimestamp = timestamp.replace(":", "-").replace(" ", "_");
        String prefix = isGroup ? "group_" + destination : "private_" + sender + "_" + destination;
        String fileName = prefix + "_" + cleanTimestamp + "_" + sourceAudio.getName();

        File destFile = new File(AUDIO_HISTORY_DIR, fileName);

        try (FileInputStream fis = new FileInputStream(sourceAudio);
                FileOutputStream fos = new FileOutputStream(destFile)) {

            byte[] buffer = new byte[4096];
            int bytesRead;
            while ((bytesRead = fis.read(buffer)) != -1) {
                fos.write(buffer, 0, bytesRead);
            }

        } catch (IOException e) {
            System.err.println("Error al copiar audio al historial: " + e.getMessage());
        }

        return destFile;
    }

    public static synchronized boolean deletePrivateHistory(String user1, String user2) {
        try{
            File f = getPrivateHistoryFile(user1,user2);
            return f.exists() && f.delete();
        }catch(Exception e){
            System.err.println("Error borrando historial privado: " + e.getMessage());
            return false;
        }
    }

    public static synchronized boolean deleteGroupHistory(String groupName) {
        try {
            File f = getGroupHistoryFile(groupName);
            return f.exists() && f.delete();
        } catch (Exception e) {
            System.err.println("Error borrando historial de grupo: " + e.getMessage());
            return false;
        }
    }

    public static synchronized List<TextMessage> loadPrivateHistory(String user1, String user2) {
        List<String> rawHistory = getPrivateHistory(user1, user2);
        List<TextMessage> messages = new ArrayList<>();

        for (String line : rawHistory) {
            // Parse: [2025-11-23 20:30:15] sender -> receiver: mensaje
            try {
                if (!line.contains("->"))
                    continue; // Skip malformed lines

                int timestampEnd = line.indexOf("]");
                String timestamp = line.substring(1, timestampEnd);

                String rest = line.substring(timestampEnd + 2); // Skip "] "
                String[] parts = rest.split(" -> ", 2);
                String sender = parts[0].trim();

                String[] contentParts = parts[1].split(": ", 2);
                String content = contentParts.length > 1 ? contentParts[1].trim() : "";

                TextMessage msg = new TextMessage();
                msg.sender = sender;
                msg.content = content;
                msg.timestamp = timestamp;

                messages.add(msg);
            } catch (Exception e) {
                System.err.println("Error parsing line: " + line);
            }
        }

        return messages;
    }

    public static synchronized List<TextMessage> loadGroupHistory(String groupName) {
        List<String> rawHistory = getGroupHistory(groupName);
        List<TextMessage> messages = new ArrayList<>();

        for (String line : rawHistory) {
            // Parse: [2025-11-23 20:30:15] sender en groupName: mensaje
            try {
                if (!line.contains(" en "))
                    continue;

                int timestampEnd = line.indexOf("]");
                String timestamp = line.substring(1, timestampEnd);

                String rest = line.substring(timestampEnd + 2);
                String[] parts = rest.split(" en ", 2);
                String sender = parts[0].trim();

                String[] contentParts = parts[1].split(": ", 2);
                String content = contentParts.length > 1 ? contentParts[1].trim() : "";

                TextMessage msg = new TextMessage();
                msg.sender = sender;
                msg.content = content;
                msg.timestamp = timestamp;

                messages.add(msg);
            } catch (Exception e) {
                System.err.println("Error parsing line: " + line);
            }
        }

        return messages;
    }

    /**
     * Guarda una nota de voz privada a partir de los bytes recibidos
     * y registra una línea [AUDIO:archivo.webm] en el historial de texto.
     */
    public static synchronized String savePrivateAudioBytes(
            String sender,
            String receiver,
            byte[] data) {
        String timestamp = LocalDateTime.now().format(formatter);

        // Nombre: private_sender_receiver_yyyy-MM-dd_HH-mm-ss.webm
        String cleanTimestamp = timestamp.replace(":", "-").replace(" ", "_");
        String fileName = "private_" + sender + "_" + receiver + "_" + cleanTimestamp + ".webm";

        File destFile = new File(AUDIO_HISTORY_DIR, fileName);

        try (FileOutputStream fos = new FileOutputStream(destFile)) {
            fos.write(data);
            fos.flush();
            fos.getFD().sync();
        } catch (IOException e) {
            System.err.println("Error al guardar audio en historial: " + e.getMessage());
        }

        // Registrar referencia en historial de texto
        String logEntry = String.format(
                "[%s] %s -> %s: [AUDIO:%s]%n",
                timestamp, sender, receiver, fileName);
        appendToFile(getPrivateHistoryFile(sender, receiver), logEntry);

        return fileName;
    }

    /**
     * Guarda una nota de voz grupal desde bytes y registra
     * [AUDIO:archivo.webm] en el historial del grupo.
     */
    public static synchronized String saveGroupAudioBytes(
            String sender,
            String groupName,
            byte[] data) {
        String timestamp = LocalDateTime.now().format(formatter);

        // Nombre: group_groupName_sender_yyyy-MM-dd_HH-mm-ss.webm
        String cleanTimestamp = timestamp.replace(":", "-").replace(" ", "_");
        String fileName = "group_" + groupName + "_" + sender + "_" + cleanTimestamp + ".webm";

        File destFile = new File(AUDIO_HISTORY_DIR, fileName);

        try (FileOutputStream fos = new FileOutputStream(destFile)) {
            fos.write(data);
            fos.flush();
            fos.getFD().sync();
        } catch (IOException e) {
            System.err.println("Error al guardar audio de grupo: " + e.getMessage());
        }

        String logEntry = String.format(
                "[%s] %s en %s: [AUDIO:%s]%n",
                timestamp, sender, groupName, fileName);
        appendToFile(getGroupHistoryFile(groupName), logEntry);

        return fileName;
    }

}