package persistencia;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import model.Mensaje;
import java.io.*;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.List;

public class ArchivadorDeHistorial {
    private static final Gson gson = new GsonBuilder().setPrettyPrinting().create();
    private static final String RUTA_HISTORIALES = "server_data/historiales/";

    public ArchivadorDeHistorial() {
        new File(RUTA_HISTORIALES).mkdirs();
    }

    public synchronized void guardarMensajeDeGrupo(String nombreDelGrupo, Mensaje mensaje) {
        String rutaDelArchivo = RUTA_HISTORIALES + "grupo_" + nombreDelGrupo + ".json";
        try {
            List<Mensaje> listaDeMensajes = leerMensajesDesdeArchivo(rutaDelArchivo);
            listaDeMensajes.add(mensaje);
            try (FileWriter escritor = new FileWriter(rutaDelArchivo)) {
                gson.toJson(listaDeMensajes, escritor);
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private List<Mensaje> leerMensajesDesdeArchivo(String rutaDelArchivo) throws IOException {
        File archivo = new File(rutaDelArchivo);
        if (!archivo.exists()) {
            return new ArrayList<>();
        }
        try (FileReader lector = new FileReader(archivo)) {
            Type tipoDeLaLista = new TypeToken<ArrayList<Mensaje>>() {}.getType();
            List<Mensaje> listaDeMensajes = gson.fromJson(lector, tipoDeLaLista);
            if (listaDeMensajes == null) {
                return new ArrayList<>();
            } else {
                return listaDeMensajes;
            }
        }
    }
}