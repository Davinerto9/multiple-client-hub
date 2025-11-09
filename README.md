# Multiple Client Hub — Chat (Java backend + proxy HTTP + cliente web)

## Equipo

- Samuel Gallego
- Anderson Romero
- Daniel Martínez
- David Chicué

## Resumen (versión actual del proyecto)
Este repositorio contiene un sistema de chat con tres partes principales:

- Backend Java (TCP): la implementación del servidor original, diseñada para comunicarse exclusivamente por sockets TCP, que gestiona usuarios, grupos, historial y transferencia de audios. Código en `src/main/java/com/icesi/chatapp/Server`.
- Proxy HTTP (Node/Express): un servidor intermedio que recibe peticiones HTTP desde el cliente web y traduce/encola comandos al servidor Java mediante sockets TCP. Código en `src/rest-api/src`.
- Cliente Web (HTML/CSS/JavaScript): cliente ligero implementado en archivos estáticos (no usa React). Archivos principales en `src/web-client/` (`index.html`, `index.js`, `index.css`).

El objetivo de esta versión es permitir que un cliente web interactúe con el backend Java mediante un proxy que transforma peticiones HTTP a los mensajes TCP que entiende el servidor original.

---

## Estructura relevante (resumen)

```
src/
├─ main/java/com/icesi/chatapp/Server/     # Backend Java (TCP)
│   ├─ Server.java                         # Servidor TCP Principal. Gestiona las conexiones de socket TCP y 
│   │                                     # el manejo de clientes (proxies) adaptados.
│   └─ MessageHistory.java                 # Maneja la persistencia de mensajes (lectura/escritura) en archivos 
│                                         # locales de forma sincronizada.
├─ rest-api/                               # Proxy HTTP (Node/Express)
│   └─ src/
│      ├─ index.js                         # Entrypoint principal del proxy Express. Define y maneja los endpoints HTTP.
│      └─ services/delegateService.js      # Módulo clave. Funciona como cliente TCP que traduce las peticiones 
│                                         # HTTP a los comandos de socket TCP que espera el servidor Java.
└─ web-client/                              # Cliente web (HTML/CSS/JS)
   ├─ index.html                            # Estructura base de la aplicación y punto de carga inicial de scripts.
   ├─ index.js                              # Entrypoint y lógica principal del cliente (p. ej., inicialización, event listeners globales).
   ├─ index.css                             # Estilos globales y diseño responsivo de la aplicación.
   └─ (otros archivos estáticos)
   ├─ services/
   │   └─ chatService.js                    # Abstracción de la comunicación. Funciones para peticiones HTTP a los endpoints del proxy.
   ├─ pages/
   │   ├─ ChatApp.js                        # Manejo del estado, lógica y renderizado de la interfaz de chat principal.
   │   └─ Home.js                           # Manejo del estado y renderizado de la vista de inicio de sesión/registro.
   └─ router/
       ├─ Router.js                         # Módulo encargado de gestionar y cambiar la vista (entre Home y ChatApp).
       └─ routes.js                         # Define el mapa de rutas y qué componente de "page" se debe renderizar para cada ruta.
```

### Notas sobre el cliente web
- El cliente web es una aplicación estática en HTML/CSS/JS que se comunica mediante HTTP con el proxy.
- No se requiere React ni build step complejo; se puede servir como archivos estáticos.

---

## Endpoints principales del proxy (resumen)

El proxy expone endpoints HTTP que el cliente web usa. Algunos endpoints disponibles:

- POST /api/login
- POST /api/messages/private  { username, recipient, message }
- POST /api/messages/group    { username, groupName, message }
- POST /api/groups            { username, groupName, members }
- GET  /api/available/:username    -> devuelve usuarios y grupos disponibles
- GET  /api/history/private/:username/:otherUser
- GET  /api/history/group/:username/:groupName
- DELETE /api/groups/:name

Los parámetros están documentados en los controladores bajo `src/rest-api/src/index.js`.

---

## Requisitos

- Java 25+ (se recomienda Java 17+)
- Gradle (o usar `gradlew` incluido)
- Node.js 25+ y npm

---

## Pasos para ejecutar (Windows PowerShell)

1) Compilar el backend Java

```powershell
.
# Desde la raíz del repositorio
.\gradlew clean build
```

2) Ejecutar el servidor Java

```powershell
java -cp build/classes/java/main com.icesi.chatapp.Server.Server
```

3) Iniciar el proxy HTTP

```powershell
cd .\src\rest-api
npm install
node src/index.js
```

4) Servir el cliente web (archivos estáticos)

Usar `npx serve`

```powershell
cd .\src\web-client
npx serve -s -l 3001
# luego abrir http://localhost:3001
```

---

## Descripción Detallada del Flujo de Comunicación

### 1. Flujo de Autenticación

[![](https://mermaid.ink/img/pako:eNplkMFOg0AQhl9lMlexLSqU3UMveDBeJIXExPSywpRuLLu4LE1bwiN58hH6Yi4lVZPOaefP9_8zOx3muiDkuFINfbakcnqUojSiWilwVQtjZS5roSzEIBqIt5KUJXil92siGYjE6P0BnrIsuQbSAUjJ7GShDTyLnRiZ-HaxSDgkL2kGU1HL6VaXUkHXNmSUqKgfscRhKYdYK9rL07eCLE7gBkjtTl8aLvDIpmOkY9fSVCIf-OmS8o046r-0mMOSmrqlxorzzpBrBUNXaPSwNLJAbk1LHlbkYoYWu8G_QrshNwy5exbCfKzcDXvncR9907q62Ixuyw3ytdg2rmvrQtjLiX9VQ6ogE-tWWeRzPziHIO9wj9z3w8mcMT8KwuDunkWMeXgY5TCaP0QRC2Z-yIKo9_B4njubOJ39r_4H232bxg?type=png)](https://mermaid.live/edit#pako:eNplkMFOg0AQhl9lMlexLSqU3UMveDBeJIXExPSywpRuLLu4LE1bwiN58hH6Yi4lVZPOaefP9_8zOx3muiDkuFINfbakcnqUojSiWilwVQtjZS5roSzEIBqIt5KUJXil92siGYjE6P0BnrIsuQbSAUjJ7GShDTyLnRiZ-HaxSDgkL2kGU1HL6VaXUkHXNmSUqKgfscRhKYdYK9rL07eCLE7gBkjtTl8aLvDIpmOkY9fSVCIf-OmS8o046r-0mMOSmrqlxorzzpBrBUNXaPSwNLJAbk1LHlbkYoYWu8G_QrshNwy5exbCfKzcDXvncR9907q62Ixuyw3ytdg2rmvrQtjLiX9VQ6ogE-tWWeRzPziHIO9wj9z3w8mcMT8KwuDunkWMeXgY5TCaP0QRC2Z-yIKo9_B4njubOJ39r_4H232bxg)

1. El cliente web envía credenciales vía HTTP POST
2. El proxy establece conexión TCP persistente con el servidor
3. El servidor valida y responde
4. El proxy mantiene la conexión TCP activa para futuras peticiones

### 2. Flujo de Mensajería Privada

[![](https://mermaid.ink/img/pako:eNplkMFuwjAMhl_F8nUMKFtpmwOX7jBtB6oVadLUi9cayEaTLkkRDPFUe4S92FIqxgGfYvv7_9g-YKkrRoGWv1pWJT9IWhmqCwU-GjJOlrIh5SAFspBuJCvH8Mrv10TWEZnRuz08LhbZNZB3QM5mKytt4Im21DPp7WyWCcjm-QJG1MhRzdbSiu2oMXJLjnss81guINU1qUrDIs2gwKBAuIGKnLY9lfeUn6NkS1CzsvTBl17WOailNDWV8vdHXbxTAS9sm5ato9MGMBmPYf6MA1wZWaFwpuUB1uylXYqHTlugW3PNBQr_rMh8Flioo9f4ld-0rs8yo9vVGsWSNtZnbeNHPh_7v2pYVWxS3SqHIgqSkwmKA-5QBMF0GCVJEIfTcHKXxInv7vvyNI7u4zgJx8E0CePjAL9P_46HcRQe_wDH-ZZ4?type=png)](https://mermaid.live/edit#pako:eNplkMFuwjAMhl_F8nUMKFtpmwOX7jBtB6oVadLUi9cayEaTLkkRDPFUe4S92FIqxgGfYvv7_9g-YKkrRoGWv1pWJT9IWhmqCwU-GjJOlrIh5SAFspBuJCvH8Mrv10TWEZnRuz08LhbZNZB3QM5mKytt4Im21DPp7WyWCcjm-QJG1MhRzdbSiu2oMXJLjnss81guINU1qUrDIs2gwKBAuIGKnLY9lfeUn6NkS1CzsvTBl17WOailNDWV8vdHXbxTAS9sm5ato9MGMBmPYf6MA1wZWaFwpuUB1uylXYqHTlugW3PNBQr_rMh8Flioo9f4ld-0rs8yo9vVGsWSNtZnbeNHPh_7v2pYVWxS3SqHIgqSkwmKA-5QBMF0GCVJEIfTcHKXxInv7vvyNI7u4zgJx8E0CePjAL9P_46HcRQe_wDH-ZZ4)

1. Cliente envía mensaje a través del endpoint HTTP
2. Proxy traduce a formato TCP y envía
3. Servidor procesa y distribuye
4. Respuesta regresa por la cadena

### 3. Flujo de Grupos

[![](https://mermaid.ink/img/pako:eNplkE1PwzAMhv-K5StlWze6tjnsUg4IIVHRSkiol9CYLqJJSppOG9P-O-k-AGk-xa8fv7G9x9oIQoY9fQ2ka7qXvLFcVRp8dNw6WcuOawcZ8B6yVpJ2BK_0fk3kI5Fbs93BQ1nm10AxAgXZjRTGwiPf8BOT3a5WOYP8uShhyjs5bawZuv5UzH2xYJAZxbUwUGY5VDivEG5AcGfOVHGmLHFo7NCZP9k7P8necRAESpJ6t-afdcbghfpuoJEYx4baaI863rbUY4CNlQKZswMFqMgqPqa4Hx0qdGtSVCHzT8HtZ4WVPvgev-2bMerS5rdp1sg-eNv7bOj83Jc7_6qWtCCbmUE7ZPF8cTRBtsctsjBcTuI0DZNoGc0XaZKmAe5O8jKJ75IkjWbhMo2SQ4Dfx39nkySODj_Ol5Rx?type=png)](https://mermaid.live/edit#pako:eNplkE1PwzAMhv-K5StlWze6tjnsUg4IIVHRSkiol9CYLqJJSppOG9P-O-k-AGk-xa8fv7G9x9oIQoY9fQ2ka7qXvLFcVRp8dNw6WcuOawcZ8B6yVpJ2BK_0fk3kI5Fbs93BQ1nm10AxAgXZjRTGwiPf8BOT3a5WOYP8uShhyjs5bawZuv5UzH2xYJAZxbUwUGY5VDivEG5AcGfOVHGmLHFo7NCZP9k7P8necRAESpJ6t-afdcbghfpuoJEYx4baaI863rbUY4CNlQKZswMFqMgqPqa4Hx0qdGtSVCHzT8HtZ4WVPvgev-2bMerS5rdp1sg-eNv7bOj83Jc7_6qWtCCbmUE7ZPF8cTRBtsctsjBcTuI0DZNoGc0XaZKmAe5O8jKJ75IkjWbhMo2SQ4Dfx39nkySODj_Ol5Rx)

1. Cliente solicita crear/gestionar grupo
2. Proxy traduce a comandos TCP
3. Servidor actualiza estructuras de datos
4. Respuesta incluye estado actual

### 4. Gestión de Sesiones
- El proxy mantiene un mapa de conexiones TCP activas
- Cada usuario tiene su propia conexión persistente
- Las sesiones se limpian al detectar desconexiones
- Opción de Recargar los chats sin recargar la página.

### 5. Manejo de Errores
- Excepciones cuando se ingresan usuarios con el mismo nombre por SessionId generado Automaticamente
- Aforo Minimo de Grupos de 2 personas.
- No se permite Crear Grupos con usuarios Inexistentes.
- Reintentos automáticos de conexión TCP
- Timeout configurable en peticiones HTTP
- Fallback a almacenamiento local si falla DB.

---

## Ventajas de la Estructura y Diseño

### 1. Estructura de Archivos Modular
La organización actual del proyecto ofrece varias ventajas clave:

1. **Separación de Responsabilidades**
   - `src/web-client/`: Interfaz de usuario y lógica del cliente
   - `src/rest-api/`: Capa de proxy y transformación de protocolos
   - `src/main/java/`: Lógica del servidor y persistencia
   Esta separación permite:
   - Desarrollo paralelo de componentes
   - Pruebas independientes de cada capa
   - Mantenimiento más sencillo
   - Escalabilidad por componente

2. **Estructura de Servicios**
   - Los servicios están organizados en carpetas dedicadas
   - Cada servicio tiene una responsabilidad única
   - Facilita la adición de nuevas funcionalidades
   - Permite versionado independiente

3. **Gestión de Dependencias**
   - Cada componente maneja sus propias dependencias
   - Evita conflictos entre versiones
   - Facilita actualizaciones parciales
   - Reduce el acoplamiento entre componentes

### 2. Generación Dinámica de HTML
La decisión de generar el HTML mediante JavaScript ofrece ventajas significativas:

1. **Flexibilidad y Mantenibilidad**
   - Permite actualizar la interfaz sin recargar la página
   - Facilita la creación de componentes reutilizables
   - Reduce la duplicación de código
   - Permite inyección condicional de elementos

2. **Mejor Experiencia de Usuario**
   - Actualizaciones parciales más eficientes
   - Transiciones y animaciones más fluidas
   - Mejor respuesta a interacciones del usuario
   - Carga inicial más rápida de la estructura base

3. **Control Programático**
   - Validación de datos antes de mostrar
   - Transformación de datos en tiempo real
   - Gestión de estados de UI más robusta
   - Mejor manejo de errores y casos extremos

### 3. Capa de Servicios (chatService.js)
El archivo `chatService.js` actúa como una capa de abstracción crucial:

```javascript
src/web-client/
└── src/
    └── services/
        └── chatService.js   # Abstracción de comunicación HTTP
```

**Funcionalidades Principales:**
1. **Gestión de Usuarios**
   - `registerUser(username, sessionId)`: Registro con manejo de sesiones
   - `getConnectedUsers()`: Lista usuarios activos

2. **Mensajería**
   - `sendPrivateMessage(sender, recipient, message)`
   - `sendGroupMessage(sender, groupName, message)`
   - `getPrivateHistory(currentUser, user)`
   - `getGroupHistory(name)`

3. **Gestión de Grupos**
   - `createGroup(groupName, users)`
   - `deleteGroup(groupName)`
   - `getAllGroups()`

**Ventajas de esta Abstracción:**
- Encapsula toda la lógica de comunicación HTTP
- Manejo consistente de errores y respuestas
- Facilita cambios en la API subyacente
- Proporciona una interfaz limpia para la UI

---

## Diseño e Interfaz de Usuario

### Aspectos Visuales
1. **Diseño Responsivo**
   - Layout fluido que se adapta a diferentes tamaños de pantalla
   - Breakpoints para móvil, tablet y desktop
   - Fuentes escalables y espaciado relativo

2. **Sistema de Colores**
   - Paleta principal: Azules profesionales (#2196f3, #1976d2)
   - Mensajes enviados: Fondo azul claro (#e3f2fd)
   - Mensajes recibidos: Gris suave (#f5f5f5)
   - Indicadores de estado y alertas

3. **Elementos de UI**
   - Botones con feedback visual al hover/click
   - Campos de entrada con validación visual
   - Indicadores de carga durante operaciones
   - Notificaciones toast para feedback

### Mejoras Estructurales
1. **Organización de Código**
   - Separación clara de responsabilidades (HTML/CSS/JS)
   - Componentes modulares y reutilizables
   - Nomenclatura consistente de clases CSS

2. **Performance**
   - Carga diferida de historiales
   - Caché de usuarios y grupos
   - Optimización de peticiones HTTP


### Innovaciones
1. **Interfaz Contextual**
   - Menú adaptativo según el contexto
   - Accesos rápidos personalizados
   - Historial inteligente

2. **Gestión de Estado**
   - Persistencia local de preferencias
   - Sincronización de estado cliente-servidor
   - Recuperación ante desconexiones

3. **Accesibilidad**
   - Soporte para lectores de pantalla
   - Navegación por teclado
   - Alto contraste configurable
   - Textos alternativos

---

**Futuras Mejoras y Roadmap (Características No Implementadas)**

Esta sección ahora lista las funcionalidades que no están operativas en la versión actual, incluyendo las características de UX que mencionaste.

 - UX Mejorada (Pendiente de Implementación)
 - Autocompletado de usuarios en el campo de texto.

 - Preview de mensajes antes de enviar.

 - Indicadores de escritura ("Escribiendo...").

 - Confirmación visual de envío (más allá de la limpieza del input).

 - Integración con el RPC de ICE.

 - Integración de Llamadas y Mensajes de Voz tipo WhatsApp, Telegram etc.

---

## Limitaciones y notas

- Las funcionalidades en tiempo real (llamadas de audio, streaming de audio en vivo) no están implementadas en la versión HTTP del cliente. Estas requieren comunicación persistente (WebSocket/WebRTC/UDP) y se implementarán más adelante al integrar el Internet Communications Engine (ICE) por ZeroC.
- La lógica y estructuras de datos del servidor Java se conservan intactas; el proxy solo traduce formatos de comunicación de peticiones HTTP a TCP.
- Si el proxy o el servidor Java cambian el formato de texto esperado, hay que sincronizar `src/rest-api/src/index.js` y `src/rest-api/src/services/delegateService.js`.



