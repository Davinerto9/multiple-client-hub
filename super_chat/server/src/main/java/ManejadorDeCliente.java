import java.io.*;
import java.net.Socket;
import java.util.Map;

public class ManejadorDeCliente implements Runnable {
    private Socket socketDelCliente;
    private PrintWriter escritor;
    private String nombreDeUsuario;
    private Map<String, ManejadorDeCliente> listaDeClientes;
    private ManejadorDeGrupos manejadorDeGrupos;

    public ManejadorDeCliente(Socket socket, Map<String, ManejadorDeCliente> listaDeClientes, ManejadorDeGrupos manejadorDeGrupos) {
        this.socketDelCliente = socket;
        this.listaDeClientes = listaDeClientes;
        this.manejadorDeGrupos = manejadorDeGrupos;
    }

    @Override
    public void run() {
        try {
            BufferedReader lector = new BufferedReader(new InputStreamReader(socketDelCliente.getInputStream()));
            this.escritor = new PrintWriter(socketDelCliente.getOutputStream(), true);

            String lineaRecibida = lector.readLine();
            if (lineaRecibida != null && lineaRecibida.startsWith("CONECTARSE_AL_SERVIDOR:")) {
                this.nombreDeUsuario = lineaRecibida.substring(25).trim();
                listaDeClientes.put(this.nombreDeUsuario, this);
                // --- CAMBIO AQUI ---
                // Mensaje sin acentos ni caracteres especiales
                escritor.println("INFO: Conexion exitosa. Bienvenido, " + this.nombreDeUsuario + "!");
            } else {
                escritor.println("ERROR:Se esperaba el comando 'CONECTARSE_AL_SERVIDOR:tu_nombre'");
                return;
            }

            while ((lineaRecibida = lector.readLine()) != null) {
                String[] partesDelComando = lineaRecibida.split(":", 3);
                String comando = partesDelComando[0];

                if (comando.equals("CREAR_GRUPO")) {
                    manejadorDeGrupos.crearNuevoGrupo(partesDelComando[1]);
                    escritor.println("INFO:El grupo '" + partesDelComando[1] + "' ha sido creado.");
                } else if (comando.equals("UNIRSE_A_GRUPO")) {
                    if (manejadorDeGrupos.unirUsuarioAGrupo(partesDelComando[1], this.nombreDeUsuario)) {
                        escritor.println("INFO:Te has unido al grupo '" + partesDelComando[1] + "'.");
                    } else {
                        escritor.println("ERROR:El grupo '" + partesDelComando[1] + "' no existe.");
                    }
                } else if (comando.equals("ENVIAR_MENSAJE_A_GRUPO")) {
                    manejadorDeGrupos.enviarMensajeAGrupo(partesDelComando[1], this.nombreDeUsuario, partesDelComando[2]);
                }
            }
        } catch (IOException e) {
            // Este bloque se ejecuta si hay un error de red (cliente se desconecta).
        } finally {
            if (nombreDeUsuario != null) {
                System.out.println("El usuario " + nombreDeUsuario + " se ha desconectado del chat de texto.");
                listaDeClientes.remove(nombreDeUsuario);
            }
            try {
                socketDelCliente.close();
            } catch (IOException e) {
                // Ignorar error al cerrar.
            }
        }
    }

    public void enviarMensaje(String mensaje) {
        escritor.println(mensaje);
    }
}
