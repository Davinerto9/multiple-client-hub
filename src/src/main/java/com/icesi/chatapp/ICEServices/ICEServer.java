package com.icesi.chatapp.ICEServices;

import com.zeroc.Ice.Communicator;
import com.zeroc.Ice.ObjectAdapter;
import com.zeroc.Ice.Util;

public class ICEServer {

    public static void main(String[] args) {
        try (Communicator communicator = Util.initialize(args)) {

            // Configurar WebSocket HTTP para navegadores
            ObjectAdapter adapter = communicator.createObjectAdapterWithEndpoints(
                    "ChatAdapter",
                    "ws -h 0.0.0.0 -p 12345");

            // Crear instancias del patrón Observer
            ChatServicesImpl chatServices = new ChatServicesImpl(null); // null temporalmente
            ChatSubjectImpl subject = new ChatSubjectImpl(chatServices); // pasar la referencia

            // Ahora asignar el subject al chatServices
            chatServices.setSubject(subject);

            adapter.add(chatServices, Util.stringToIdentity("ChatService"));
            adapter.add(subject, Util.stringToIdentity("Subject"));
            adapter.activate();

            System.out.println("╔════════════════════════════════════════════════╗");
            System.out.println("║          ZEROC ICE CHAT SERVER                 ║");
            System.out.println("║      WebSocket: ws://192.168.18.183:12345      ║");
            System.out.println("║      ChatService: ChatService                  ║");
            System.out.println("║      Subject: Subject                          ║");
            System.out.println("║      Callbacks en tiempo real activados        ║");
            System.out.println("╚════════════════════════════════════════════════╝");

            communicator.waitForShutdown();

        } catch (Exception e) {
            System.err.println("Error en servidor: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
