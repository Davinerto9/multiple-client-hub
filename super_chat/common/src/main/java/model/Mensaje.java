package model;

import java.io.Serializable;

public class Mensaje implements Serializable {
    private long marcaDeTiempo;
    private String nombreRemitente;
    private String tipoDeMensaje;
    private String contenido;

    public Mensaje(long marcaDeTiempo, String nombreRemitente, String tipoDeMensaje, String contenido) {
        this.marcaDeTiempo = marcaDeTiempo;
        this.nombreRemitente = nombreRemitente;
        this.tipoDeMensaje = tipoDeMensaje;
        this.contenido = contenido;
    }

    public long obtenerMarcaDeTiempo() { return marcaDeTiempo; }
    public String obtenerNombreRemitente() { return nombreRemitente; }
    public String obtenerTipoDeMensaje() { return tipoDeMensaje; }
    public String obtenerContenido() { return contenido; }
}
