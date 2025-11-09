# Multiple Client Hub - Sistema de Chat con Cliente Web

## Descripción General
Este proyecto es una aplicación de chat que soporta tanto clientes Java como web, permitiendo la comunicación entre usuarios a través de mensajería de texto y llamadas de audio. El sistema está estructurado en tres módulos principales:
- **Cliente Java**: Implementación original con soporte completo de funcionalidades
- **Cliente Web**: Nueva implementación HTTP para funciones básicas de chat
- **Servidor**: Backend en Java que maneja la lógica central del sistema

El sistema utiliza una combinación de protocolos TCP/IP para el cliente Java y HTTP para el cliente web, con un proxy que traduce las peticiones entre ambos.

---

## Estructura del Proyecto

```
src/
├── main/java/com/icesi/chatapp/          # Backend Java
│   ├── Client/                           # Cliente Java original
│   │   ├── AudioCallReceiver.java
│   │   ├── AudioCallSender.java
│   │   ├── AudioPlayer.java
│   │   ├── AudioSender.java
│   │   ├── Client.java
│   │   └── ClientAudioReceiver.java
│   └── Server/                           # Servidor Java
│       ├── ClientHandler.java
│       ├── MessageHistory.java
│       └── Server.java
├── rest-api/                             # Servidor proxy HTTP
│   ├── src/
│   │   ├── index.js                      # Punto de entrada del proxy
│   │   └── services/
│   │       └── delegateService.js        # Servicios de traducción HTTP-TCP
│   └── package.json
└── web-client/                           # Cliente web React
    ├── src/
    │   ├── pages/
    │   │   └── ChatApp.js               # Componente principal del chat
    │   └── components/                   # Componentes reutilizables
    ├── index.html
    └── package.json
```

### Carpetas y Archivos Clave
- **Client/**: Lógica del cliente, manejo de mensajes, llamadas y audio.
- **Server/**: Lógica del servidor, gestión de clientes, historial y mensajes.
- **audios_recibidos/**: Audios recibidos por los clientes.
- **server_audios/**: Audios almacenados en el servidor.
- **chat_history/**: Historial de chats grupales y privados.

---

## Descripción de Componentes

### Módulo Cliente (`Client/`)
- **Client.java**: Punto de entrada del cliente. Gestiona la conexión al servidor, envío y recepción de mensajes.
- **AudioCallSender.java**: Envía audio en tiempo real al servidor durante una llamada.
- **AudioCallReceiver.java**: Recibe y reproduce audio de una llamada entrante.
- **AudioPlayer.java**: Reproduce archivos de audio recibidos.
- **AudioSender.java**: Envía archivos de audio grabados al servidor.
- **ClientAudioReceiver.java**: Recibe archivos de audio enviados por otros usuarios.

### Módulo Servidor (`Server/`)
- **Server.java**: Punto de entrada del servidor. Acepta conexiones de clientes y distribuye mensajes.
- **ClientHandler.java**: Hilo dedicado a cada cliente conectado. Gestiona mensajes, llamadas y archivos de audio.
- **MessageHistory.java**: Maneja el almacenamiento y recuperación del historial de mensajes (grupales y privados).

---

## Instrucciones de Uso

### 1. Requisitos Previos
- Java 25 o superior (Cambiar la versión de la Máquina en build.gradle)
- Gradle (o usar los scripts `gradle`/`gradlew.bat` incluidos)
- Node.js 14 o superior
- npm o yarn

### 2. Instalación y Configuración

#### Backend Java
Desde la raíz del proyecto, ejecuta:

**En Windows:**
```
gradlew.bat build
```
**En Linux/Mac:**
```
./gradle build
```

#### Servidor Proxy HTTP
```bash
cd src/rest-api
npm install
```

#### Cliente Web
```bash
cd src/web-client
npm install
```

### 3. Ejecución del Sistema

#### a) Iniciar el Servidor Java
```bash
java -cp build/classes/java/main com.icesi.chatapp.Server.Server
```

#### b) Iniciar el Servidor Proxy
```bash
cd src/rest-api
npm start
```

#### c) Iniciar el Cliente Web
```bash
cd src/web-client
npm start
```

#### d) (Opcional) Iniciar Cliente Java
```bash
java -cp build/classes/java/main com.icesi.chatapp.Client.Client
```

### 4. Funcionalidades

#### Cliente Web (HTTP)
- **Mensajería privada**: Envío de mensajes entre usuarios
- **Grupos de chat**: Creación y mensajería grupal
- **Historial**: Visualización de mensajes anteriores
- **Interfaz intuitiva**: Diseño moderno y responsive

#### Cliente Java (Original)
- **Todas las funciones del cliente web**
- **Llamadas de audio**: Comunicación por voz en tiempo real
- **Notas de voz**: Envío y reproducción de mensajes de audio
- **Gestión avanzada de grupos**: Más opciones de administración

### 5. Archivos Generados
- **chat_history/**: Historial de mensajes
- **server_audios/**: Audios almacenados (cliente Java)
- **audios_recibidos/**: Audios recibidos (cliente Java)

---

## Notas Adicionales
- Asegúrate de que el puerto utilizado por el servidor esté libre.
- Puedes modificar la configuración de red (puerto, IP) en los archivos fuente si es necesario.
- Para pruebas locales, ejecuta servidor y clientes en la misma máquina.

---

## Créditos
Desarrollado por el equipo de:

- Samuel Gallego

- Anderson Romero

- Daniel Martínez

- David Chicué

Para la clase de Computación en Internet 1(Universidad Icesi).

---

## Elección de protocolos por funcionalidad

Esta sección explica qué protocolos son recomendables para cada funcionalidad del sistema, por qué y qué implicaciones tiene su uso en la implementación.

## 1) Mensajería de texto (chat grupal y privado)
- Protocolo recomendado: TCP (sockets Java tradicionales) o WebSocket
- Por qué: La mensajería de texto requiere entrega fiable y ordenada. TCP garantiza ambos y es fácil de usar con sockets Java existentes. WebSocket es útil si se planea exponer una interfaz web o clientes JavaScript en el futuro.

## 2) Envío y transferencia de archivos (audios grabados)
- Protocolo recomendado: TCP
- Por qué: La transferencia de archivos requiere integridad completa; TCP administra retransmisión de paquetes y garantiza la entrega completa del archivo.

## 3) Audio en tiempo real (streaming, llamadas de audio)
- Protocolo recomendado: UDP con RTP (Real-time Transport Protocol) o directamente UDP para simplicidad; como alternativa WebRTC para navegadores.
- Por qué: Las llamadas de audio en tiempo real priorizan la latencia sobre la entrega completa. UDP evita la latencia introducida por retransmisiones de TCP. RTP añade temporización, secuenciación y marcas de tiempo útiles para la reconstrucción del flujo de audio.
- Consideraciones:
  - Debes introducir un buffer de playback y manejo de jitter en el cliente (`AudioCallReceiver` / `AudioPlayer`).
  - Implementa detección de pérdida de paquetes y técnicas de concealment o FEC si la calidad es crítica.
  - Para comunicación segura, combinar con SRTP (Secure RTP) o tunelizar sobre DTLS (como hace WebRTC).

4) Señalización para llamadas (establecer/terminar llamada, intercambio de metadatos)
- Protocolo recomendado: TCP (mensajería) o WebSocket
- Por qué: La señalización requiere entrega fiable de mensajes de control (invitar a llamada, aceptar, colgar). TCP o WebSocket proveen fiabilidad y facilidad de integración con la lógica existente.
- Consideraciones:
  - Separar la señalización del canal de audio (ej. señalización por TCP + media por UDP/RTP).

5) Historial y almacenamiento (logs de chat, archivos en servidor)
- Protocolo recomendado: TCP (para transferencia confiable entre cliente/servidor) y acceso local a disco en el servidor
- Por qué: El almacenamiento de historial y archivos debe garantizar que los datos no se corrompan; TCP es apropiado para transmitir dichos datos y luego guardarlos en disco.

  ---

  ## Uso de PostgreSQL 

  Para Consultar el almacenamiento de historial y metadatos de audio a una base de datos PostgreSQL en pgAdmin4, sigue estos pasos.

  1) Instalar PostgreSQL
  - En Windows descarga e instala desde https://www.postgresql.org/download/windows/ y crea una base de datos (por ejemplo `chatapp`) y un usuario con permisos.

  2) Configura la BD
  - En la clase Database.java están las credenciales de acceso a la base de datos. 
 ```powershell
        String dbHost = "192.168.1.10"; 
        int dbPort = 5432;
        String dbName = "chatdb";
        String dbUser = "chat";
        String dbPassword = "chatpass";
  ```
  3) Inicializar tablas
  - La aplicación intentará crear las tablas `messages` y `audio_files` automáticamente al iniciarse si `DB_URL` está presente en las variables de entorno(Ya están creadas y disponibles para su consulta usando las sentencias SQL: SELECT * FROM table_name O SELECT name FROM table_name WHERE id = 2 ).

  4) Comprobaciones y notas
  - Si la BD no está disponible o ocurre un error, la aplicación seguirá funcionando con el almacenamiento por archivos (fallback).
 