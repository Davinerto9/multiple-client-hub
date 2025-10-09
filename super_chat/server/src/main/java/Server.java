import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketAddress;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import persistencia.ArchivadorDeHistorial;

public class Server {
    public static void main(String[] args) {
        Thread hiloDelServidorTCP = new Thread(() -> iniciarServidorDeChatTCP());
        Thread hiloDelServidorUDP = new Thread(() -> iniciarServidorDeVozUDP());
        hiloDelServidorTCP.start();
        hiloDelServidorUDP.start();
    }

    public static void iniciarServidorDeChatTCP() {
        try (ServerSocket socketDeEscuchaTCP = new ServerSocket(9090)) {
            System.out.println("Servidor de Chat (TCP) activo en el puerto 9090.");
            Map<String, ManejadorDeCliente> listaDeClientes = new ConcurrentHashMap<>();
            Map<String, Set<String>> listaDeGrupos = new ConcurrentHashMap<>();
            ArchivadorDeHistorial archivador = new ArchivadorDeHistorial();
            ManejadorDeGrupos manejadorDeGrupos = new ManejadorDeGrupos(listaDeClientes, listaDeGrupos, archivador);

            while (true) {
                Socket socketDelCliente = socketDeEscuchaTCP.accept();
                ManejadorDeCliente nuevoManejador = new ManejadorDeCliente(socketDelCliente, listaDeClientes, manejadorDeGrupos);
                new Thread(nuevoManejador).start();
            }
        } catch (IOException e) {
            System.err.println("Error fatal en el servidor TCP: " + e.getMessage());
        }
    }

    public static void iniciarServidorDeVozUDP() {
        try (DatagramSocket socketDeVozUDP = new DatagramSocket(9091)) {
            System.out.println("Servidor de Voz (UDP) activo en el puerto 9091.");
            Map<String, SocketAddress> participantesEnLlamada = new HashMap<>();
            byte[] bufferDeAudio = new byte[1025];

            while (true) {
                DatagramPacket paqueteRecibido = new DatagramPacket(bufferDeAudio, bufferDeAudio.length);
                socketDeVozUDP.receive(paqueteRecibido);
                byte tipoDeMensaje = paqueteRecibido.getData()[0];
                
                if (tipoDeMensaje == 1) {
                    String nombreDeUsuario = new String(paqueteRecibido.getData(), 1, paqueteRecibido.getLength() - 1).trim();
                    System.out.println("VOZ: " + nombreDeUsuario + " se ha unido a la llamada de voz.");
                    participantesEnLlamada.put(nombreDeUsuario, paqueteRecibido.getSocketAddress());
                } else if (tipoDeMensaje == 2) {
                    for (SocketAddress direccionDestino : participantesEnLlamada.values()) {
                        if (!direccionDestino.equals(paqueteRecibido.getSocketAddress())) {
                            DatagramPacket paqueteAEnviar = new DatagramPacket(
                                paqueteRecibido.getData(),
                                paqueteRecibido.getLength(),
                                direccionDestino
                            );
                            socketDeVozUDP.send(paqueteAEnviar);
                        }
                    }
                }
            }
        } catch (IOException e) {
            System.err.println("Error fatal en el servidor UDP: " + e.getMessage());
        }
    }
}
