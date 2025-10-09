import javax.sound.sampled.*;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.io.IOException;
import java.net.*;
import java.util.Scanner;

public class Client {
    private static Socket socketTCP;
    private static PrintWriter escritorTCP;
    private static DatagramSocket socketUDP;
    private static InetAddress ipServidorUDP;
    private static final int PUERTO_SERVIDOR_UDP = 9091;
    private static volatile boolean enLlamada = false;

    public static void main(String[] args) throws Exception {
        Scanner lectorDeConsola = new Scanner(System.in);
        
        try {
            socketTCP = new Socket("127.0.0.1", 9090); 
            escritorTCP = new PrintWriter(socketTCP.getOutputStream(), true);
        } catch (IOException e) {
            System.out.println("Error: No se pudo conectar al servidor. Asegurate de que el servidor este corriendo.");
            return;
        }

        BufferedReader lectorTCP = new BufferedReader(new InputStreamReader(socketTCP.getInputStream()));

        System.out.print("Ingresa tu nombre de usuario: ");
        String nombreDeUsuario = lectorDeConsola.nextLine();
        escritorTCP.println("CONECTARSE_AL_SERVIDOR:" + nombreDeUsuario);
        
        // Esperamos la respuesta del servidor ANTES de continuar
        String respuestaLogin = lectorTCP.readLine();
        System.out.println("<-- " + respuestaLogin);
        // Si el login falla, cerramos el program
        if (respuestaLogin == null || !respuestaLogin.contains("exitosa")) {
            System.out.println("Fallo en la conexion. Cerrando programa.");
            socketTCP.close();
            return;
        }

        new Thread(() -> {
            try {
                String mensajeDelServidor;
                while ((mensajeDelServidor = lectorTCP.readLine()) != null) {
                    System.out.println("\n<-- " + mensajeDelServidor);
                }
            } catch (Exception e) { 
                System.out.println("\nSe ha perdido la conexion con el servidor.");
            }
        }).start();

        socketUDP = new DatagramSocket();
        ipServidorUDP = InetAddress.getByName("127.0.0.1");

        while (true) {
            mostrarMenu();
            System.out.print("Elige una opcion: ");
            int opcion = lectorDeConsola.nextInt();
            lectorDeConsola.nextLine();

            switch (opcion) {
                case 1:
                    System.out.print("Nombre del grupo a crear: ");
                    escritorTCP.println("CREAR_GRUPO:" + lectorDeConsola.nextLine());
                    break;
                case 2:
                    System.out.print("Nombre del grupo a unirse: ");
                    escritorTCP.println("UNIRSE_A_GRUPO:" + lectorDeConsola.nextLine());
                    break;
                case 3:
                    System.out.print("Nombre del grupo: ");
                    String grupo = lectorDeConsola.nextLine();
                    System.out.print("Mensaje: ");
                    String msg = lectorDeConsola.nextLine();
                    escritorTCP.println("ENVIAR_MENSAJE_A_GRUPO:" + grupo + ":" + msg);
                    break;
                case 4:
                    if (!enLlamada) {
                        iniciarLlamadaDeVoz(nombreDeUsuario);
                    } else {
                        detenerLlamadaDeVoz();
                    }
                    break;
                case 5:
                    if (enLlamada) detenerLlamadaDeVoz();
                    socketTCP.close(); //añadi esto 
                    return;
            }
            Thread.sleep(500);
        }
    }

    public static void iniciarLlamadaDeVoz(String nombreDeUsuario) {
        enLlamada = true;
        System.out.println(">>> Iniciando llamada de voz! Presiona 4 de nuevo para colgar.");
        
        try {
            byte[] mensajeDeUnion = ("1" + nombreDeUsuario).getBytes();
            DatagramPacket paqueteDeUnion = new DatagramPacket(mensajeDeUnion, mensajeDeUnion.length, ipServidorUDP, PUERTO_SERVIDOR_UDP);
            socketUDP.send(paqueteDeUnion);
        } catch (IOException e) {
            System.err.println("No se pudo notificar al servidor UDP.");
            enLlamada = false;
            return;
        }

        new Thread(() -> {
            try {
                AudioFormat formato = new AudioFormat(8000.0f, 16, 1, true, false);
                TargetDataLine microfono = AudioSystem.getTargetDataLine(formato);
                microfono.open(formato);
                microfono.start();
                
                byte[] buffer = new byte[1025];
                buffer[0] = 2;

                while (enLlamada) {
                    int bytesLeidos = microfono.read(buffer, 1, 1024);
                    DatagramPacket paqueteDeAudio = new DatagramPacket(buffer, bytesLeidos + 1, ipServidorUDP, PUERTO_SERVIDOR_UDP);
                    socketUDP.send(paqueteDeAudio);
                }
            } catch (Exception e) {}
        }).start();

        new Thread(() -> {
            try {
                AudioFormat formato = new AudioFormat(8000.0f, 16, 1, true, false);
                SourceDataLine altavoz = AudioSystem.getSourceDataLine(formato);
                altavoz.open(formato);
                altavoz.start();

                byte[] buffer = new byte[1025];
                DatagramPacket paqueteRecibido = new DatagramPacket(buffer, buffer.length);
                
                while (enLlamada) {
                    socketUDP.receive(paqueteRecibido);
                    altavoz.write(paqueteRecibido.getData(), 1, paqueteRecibido.getLength() - 1);
                }
            } catch (Exception e) {}
        }).start();
    }

    public static void detenerLlamadaDeVoz() {
        enLlamada = false;
        System.out.println("<<< Llamada de voz finalizada.");
    }

    // --- CAMBIO AQUI ---
    // Menú sin acentos ni caracteres especiales
    private static void mostrarMenu() {
        System.out.println("\n--- MENU SUPER CHAT ---\n");
        System.out.println("1. Crear Grupo (Texto)");
        System.out.println("2. Unirse a Grupo (Texto)");
        System.out.println("3. Enviar Mensaje a Grupo (Texto)");
        System.out.println(enLlamada ? "4. Colgar Llamada de Voz" : "4. Unirse a la Llamada de Voz");
        System.out.println("5. Salir");
    }
}