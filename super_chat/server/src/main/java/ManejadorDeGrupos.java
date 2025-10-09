import model.Mensaje;
import persistencia.ArchivadorDeHistorial;
import java.util.Map;
import java.util.Set;

public class ManejadorDeGrupos {
    private final Map<String, Set<String>> listaDeGrupos;
    private final Map<String, ManejadorDeCliente> listaDeClientes;
    private final ArchivadorDeHistorial archivador;

    public ManejadorDeGrupos(Map<String, ManejadorDeCliente> listaDeClientes, Map<String, Set<String>> listaDeGrupos, ArchivadorDeHistorial archivador) {
        this.listaDeClientes = listaDeClientes;
        this.listaDeGrupos = listaDeGrupos;
        this.archivador = archivador;
    }

    public void crearNuevoGrupo(String nombreDelGrupo) {
        listaDeGrupos.putIfAbsent(nombreDelGrupo, new java.util.concurrent.CopyOnWriteArraySet<>());
    }

    public boolean unirUsuarioAGrupo(String nombreDelGrupo, String nombreDeUsuario) {
        Set<String> miembros = listaDeGrupos.get(nombreDelGrupo);
        if (miembros != null) {
            miembros.add(nombreDeUsuario);
            return true;
        } else {
            return false;
        }
    }

    public void enviarMensajeAGrupo(String nombreDelGrupo, String nombreRemitente, String textoDelMensaje) {
        Mensaje mensajeParaGuardar = new Mensaje(System.currentTimeMillis(), nombreRemitente, "TEXTO", textoDelMensaje);
        archivador.guardarMensajeDeGrupo(nombreDelGrupo, mensajeParaGuardar);

        Set<String> miembrosDelGrupo = listaDeGrupos.get(nombreDelGrupo);
        if (miembrosDelGrupo != null) {
            String mensajeDeRed = "MENSAJE_DE_GRUPO:" + nombreDelGrupo + ":" + nombreRemitente + ":" + textoDelMensaje;
            for (String nombreDelMiembro : miembrosDelGrupo) {
                ManejadorDeCliente manejadorDelMiembro = listaDeClientes.get(nombreDelMiembro);
                if (manejadorDelMiembro != null) {
                    manejadorDelMiembro.enviarMensaje(mensajeDeRed);
                }
            }
        }
    }
}
