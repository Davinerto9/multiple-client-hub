-- Script de inicialización para PostgreSQL (init_postgres.sql)
-- Cambia los valores <chatapp_user> y <password> antes de ejecutar

-- Crear base de datos
CREATE DATABASE chatapp;

-- Conectar como superusuario o rol con permisos para crear usuarios
\c chatapp

-- Crear usuario (si no existe) y otorgar permisos
-- Reemplaza <chatapp_user> y <password> antes de ejecutar
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'chatapp_user') THEN
       CREATE ROLE chatapp_user LOGIN PASSWORD 'change_me';
   END IF;
END
$$;

GRANT CONNECT ON DATABASE chatapp TO chatapp_user;

\c chatapp

-- Crear tablas de la aplicación
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    type VARCHAR(20) NOT NULL,
    sender VARCHAR(255),
    target VARCHAR(255),
    is_group BOOLEAN,
    content TEXT
);

CREATE TABLE IF NOT EXISTS audio_files (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    sender VARCHAR(255),
    target VARCHAR(255),
    is_group BOOLEAN,
    file_path TEXT
);

-- Otorgar permisos a chatapp_user
GRANT INSERT, SELECT, UPDATE ON ALL TABLES IN SCHEMA public TO chatapp_user;
