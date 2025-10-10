package com.icesi.chatapp.Server;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import java.io.File;
import java.sql.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

public class Database {
    private static HikariDataSource ds;
    private static final DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /**
     * Inicializa la conexión con configuración embebida.
     * No depende de variables de entorno.
     */
    public static synchronized void init() throws SQLException {
        if (ds != null)
            return;
        String dbHost = "192.168.1.10"; // o "localhost" si es la misma máquina
        int dbPort = 5432;
        String dbName = "chatdb";
        String dbUser = "chat";
        String dbPassword = "chatpass";
        String dbUrl = String.format("jdbc:postgresql://%s:%d/%s", dbHost, dbPort, dbName);

        // Connection Pool
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(dbUrl);
        config.setUsername(dbUser);
        config.setPassword(dbPassword);
        config.setMaximumPoolSize(5);
        config.setMinimumIdle(1);
        config.setPoolName("ChatAppPool");

        ds = new HikariDataSource(config);

        // creacion de tablas si no existen
        try (Connection conn = ds.getConnection()) {
            try (Statement st = conn.createStatement()) {
                st.execute("""
                        CREATE TABLE IF NOT EXISTS messages (
                            id BIGSERIAL PRIMARY KEY,
                            created_at TIMESTAMP NOT NULL,
                            type VARCHAR(20) NOT NULL,
                            sender VARCHAR(255),
                            target VARCHAR(255),
                            is_group BOOLEAN,
                            content TEXT
                        )
                        """);

                st.execute("""
                        CREATE TABLE IF NOT EXISTS audio_files (
                            id BIGSERIAL PRIMARY KEY,
                            created_at TIMESTAMP NOT NULL,
                            sender VARCHAR(255),
                            target VARCHAR(255),
                            is_group BOOLEAN,
                            file_path TEXT
                        )
                        """);
            }
        }

        System.out.println("Conexión a PostgreSQL establecida correctamente en: " + dbUrl);
    }

    public static Connection getConnection() throws SQLException {
        if (ds == null)
            throw new IllegalStateException("DataSource no inicializada. Llama a Database.init().");
        return ds.getConnection();
    }

    public static void saveTextMessage(String type, String sender, String target, boolean isGroup, String content) {
        try (Connection conn = getConnection()) {
            String sql = "INSERT INTO messages(created_at, type, sender, target, is_group, content) VALUES (?, ?, ?, ?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setTimestamp(1, Timestamp.valueOf(LocalDateTime.now()));
                ps.setString(2, type);
                ps.setString(3, sender);
                ps.setString(4, target);
                ps.setBoolean(5, isGroup);
                ps.setString(6, content);
                ps.executeUpdate();
            }
        } catch (SQLException e) {
            System.err.println("Error guardando mensaje en DB: " + e.getMessage());
        }
    }

    public static void saveAudioRecord(String sender, String target, boolean isGroup, String filePath) {
        try (Connection conn = getConnection()) {
            String sql = "INSERT INTO audio_files(created_at, sender, target, is_group, file_path) VALUES (?, ?, ?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setTimestamp(1, Timestamp.valueOf(LocalDateTime.now()));
                ps.setString(2, sender);
                ps.setString(3, target);
                ps.setBoolean(4, isGroup);
                ps.setString(5, filePath);
                ps.executeUpdate();
            }
        } catch (SQLException e) {
            System.err.println("Error guardando audio en DB: " + e.getMessage());
        }
    }

    /**
     * Ejecuta un script SQL desde un archivo en la conexión configurada.
     */
    public static void runSqlFile(String pathToSqlFile) {
        try (Connection conn = getConnection()) {
            File sqlFile = new File(pathToSqlFile);
            if (!sqlFile.exists()) {
                System.err.println("SQL file not found: " + pathToSqlFile);
                return;
            }
            StringBuilder sb = new StringBuilder();
            try (java.io.BufferedReader br = new java.io.BufferedReader(new java.io.FileReader(sqlFile))) {
                String line;
                while ((line = br.readLine()) != null) {
                    sb.append(line).append('\n');
                }
            }
            String[] statements = sb.toString().split(";\s*\n");
            try (Statement st = conn.createStatement()) {
                for (String stmt : statements) {
                    if (stmt.trim().isEmpty())
                        continue;
                    st.execute(stmt);
                }
            }
            System.out.println("SQL script executed: " + pathToSqlFile);
        } catch (Exception e) {
            System.err.println("Error ejecutando script SQL: " + e.getMessage());
        }
    }

    public static List<String> getPrivateHistory(String user1, String user2) {
        List<String> out = new ArrayList<>();
        try (Connection conn = getConnection()) {
            String sql = """
                    SELECT created_at, sender, target, content
                    FROM messages
                    WHERE is_group = false
                    AND ((sender = ? AND target = ?) OR (sender = ? AND target = ?))
                    ORDER BY created_at ASC
                    """;
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, user1);
                ps.setString(2, user2);
                ps.setString(3, user2);
                ps.setString(4, user1);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        Timestamp ts = rs.getTimestamp(1);
                        String sender = rs.getString(2);
                        String target = rs.getString(3);
                        String content = rs.getString(4);
                        out.add(String.format("[%s] %s -> %s: %s", ts.toString(), sender, target, content));
                    }
                }
            }
        } catch (SQLException e) {
            System.err.println("Error leyendo historial privado desde DB: " + e.getMessage());
        }
        return out;
    }

    public static List<String> getGroupHistory(String groupName) {
        List<String> out = new ArrayList<>();
        try (Connection conn = getConnection()) {
            String sql = """
                    SELECT created_at, sender, content
                    FROM messages
                    WHERE is_group = true AND target = ?
                    ORDER BY created_at ASC
                    """;
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, groupName);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        Timestamp ts = rs.getTimestamp(1);
                        String sender = rs.getString(2);
                        String content = rs.getString(3);
                        out.add(String.format("[%s] %s en %s: %s", ts.toString(), sender, groupName, content));
                    }
                }
            }
        } catch (SQLException e) {
            System.err.println("Error leyendo historial de grupo desde DB: " + e.getMessage());
        }
        return out;
    }

    // Cerrar datasource
    public static synchronized void shutdown() {
        if (ds != null) {
            ds.close();
            ds = null;
        }
    }
}
