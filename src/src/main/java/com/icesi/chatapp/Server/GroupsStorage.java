package com.icesi.chatapp.Server;

import java.io.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class GroupsStorage {
    
    private static final String GROUPS_DIR = "src/groups_data/";
    private static final String GROUPS_FILE = GROUPS_DIR + "groups.txt";

    static {
        new File(GROUPS_DIR).mkdirs();
    }

    // Cargar todos los grupos al iniciar
    public static synchronized Map<String, Set<String>> loadGroups() {
        Map<String, Set<String>> groups = new ConcurrentHashMap<>();
        File f = new File(GROUPS_FILE);
        if (!f.exists()) {
            return groups;
        }

        try (BufferedReader br = new BufferedReader(new FileReader(f))) {
            String line;
            while ((line = br.readLine()) != null) {
                // Formato: groupName|member1,member2,member3
                String[] parts = line.split("\\|", 2);
                if (parts.length != 2)
                    continue;

                String name = parts[0].trim();
                String[] membersArr = parts[1].split(",");
                Set<String> members = ConcurrentHashMap.newKeySet();
                for (String m : membersArr) {
                    String clean = m.trim();
                    if (!clean.isEmpty()) {
                        members.add(clean);
                    }
                }
                if (!name.isEmpty()) {
                    groups.put(name, members);
                }
            }
        } catch (IOException e) {
            System.err.println("Error leyendo groups.txt: " + e.getMessage());
        }
        return groups;
    }

    // Guardar todos los grupos tras cada cambio
    public static synchronized void saveGroups(Map<String, Set<String>> groups) {
        File f = new File(GROUPS_FILE);
        try (BufferedWriter bw = new BufferedWriter(new FileWriter(f, false))) {
            for (Map.Entry<String, Set<String>> e : groups.entrySet()) {
                String name = e.getKey();
                Set<String> members = e.getValue();
                bw.write(name + "|" + String.join(",", members));
                bw.newLine();
            }
        } catch (IOException ex) {
            System.err.println("Error guardando groups.txt: " + ex.getMessage());
        }
    }
}
