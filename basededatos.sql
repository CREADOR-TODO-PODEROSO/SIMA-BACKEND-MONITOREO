SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE;
SET SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

DROP DATABASE IF EXISTS `sigma_mvp`;
CREATE DATABASE IF NOT EXISTS `sigma_mvp`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `sigma_mvp`;

-- =====================================================
-- Catalogos y seguridad base
-- =====================================================

CREATE TABLE `roles` (
  `id_rol` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(50) NOT NULL,
  `descripcion` VARCHAR(150) DEFAULT NULL,
  PRIMARY KEY (`id_rol`),
  UNIQUE KEY `uk_roles_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `usuarios` (
  `id_usuario` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(120) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `id_rol` BIGINT UNSIGNED NOT NULL,
  `estado` ENUM('ACTIVO', 'INACTIVO', 'BLOQUEADO') NOT NULL DEFAULT 'ACTIVO',
  `debe_cambiar_password` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `uk_usuarios_email` (`email`),
  KEY `idx_usuarios_estado` (`estado`),
  KEY `fk_usuarios_rol` (`id_rol`),
  CONSTRAINT `fk_usuarios_rol`
    FOREIGN KEY (`id_rol`)
    REFERENCES `roles` (`id_rol`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `personas` (
  `id_persona` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_usuario` BIGINT UNSIGNED NOT NULL,
  `tipo_documento` VARCHAR(10) NOT NULL,
  `numero_documento` VARCHAR(20) NOT NULL,
  `nombres` VARCHAR(100) NOT NULL,
  `apellidos` VARCHAR(100) NOT NULL,
  `telefono` VARCHAR(20) DEFAULT NULL,
  `foto_perfil_url` VARCHAR(500) DEFAULT NULL,
  `foto_perfil_public_id` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id_persona`),
  UNIQUE KEY `uk_personas_usuario` (`id_usuario`),
  UNIQUE KEY `uk_personas_documento` (`numero_documento`),
  CONSTRAINT `fk_personas_usuario`
    FOREIGN KEY (`id_usuario`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `auditoria_privilegiada` (
  `id_auditoria` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_usuario_responsable` BIGINT UNSIGNED DEFAULT NULL,
  `accion` VARCHAR(80) NOT NULL,
  `entidad` VARCHAR(80) NOT NULL,
  `id_entidad` BIGINT UNSIGNED DEFAULT NULL,
  `valor_anterior` JSON DEFAULT NULL,
  `valor_nuevo` JSON DEFAULT NULL,
  `motivo` VARCHAR(500) DEFAULT NULL,
  `resultado` ENUM('EXITOSO', 'FALLIDO') NOT NULL,
  `detalle_error` VARCHAR(500) DEFAULT NULL,
  `fecha_evento` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_auditoria`),
  KEY `idx_auditoria_usuario_fecha` (`id_usuario_responsable`, `fecha_evento`),
  KEY `idx_auditoria_entidad_fecha` (`entidad`, `id_entidad`, `fecha_evento`),
  CONSTRAINT `fk_auditoria_usuario`
    FOREIGN KEY (`id_usuario_responsable`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Estructura institucional y academica
-- =====================================================

CREATE TABLE `areas_formacion` (
  `id_area` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre_area` VARCHAR(150) NOT NULL,
  PRIMARY KEY (`id_area`),
  UNIQUE KEY `uk_areas_nombre` (`nombre_area`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `coordinador_area` (
  `id_coordinador_area` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_usuario` BIGINT UNSIGNED NOT NULL,
  `id_area` BIGINT UNSIGNED NOT NULL,
  `estado` ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  `fecha_inicio` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_fin` DATETIME DEFAULT NULL,
  `asignado_por` BIGINT UNSIGNED DEFAULT NULL,
  `cerrado_por` BIGINT UNSIGNED DEFAULT NULL,
  `motivo_cierre` VARCHAR(255) DEFAULT NULL,
  `coordinador_activo_key` BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN `estado` = 'ACTIVO' THEN `id_usuario` ELSE NULL END) VIRTUAL,
  `area_activa_key` BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN `estado` = 'ACTIVO' THEN `id_area` ELSE NULL END) VIRTUAL,
  PRIMARY KEY (`id_coordinador_area`),
  UNIQUE KEY `uk_coord_area_periodo` (`id_usuario`, `id_area`, `fecha_inicio`),
  UNIQUE KEY `uk_coord_un_area_activa` (`coordinador_activo_key`),
  UNIQUE KEY `uk_area_un_coord_activo` (`area_activa_key`),
  KEY `fk_coord_area_area` (`id_area`),
  KEY `fk_coord_area_asignado_por` (`asignado_por`),
  KEY `fk_coord_area_cerrado_por` (`cerrado_por`),
  CONSTRAINT `fk_coord_area_usuario`
    FOREIGN KEY (`id_usuario`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_coord_area_area`
    FOREIGN KEY (`id_area`)
    REFERENCES `areas_formacion` (`id_area`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_coord_area_asignado_por`
    FOREIGN KEY (`asignado_por`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_coord_area_cerrado_por`
    FOREIGN KEY (`cerrado_por`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `chk_coord_area_fechas`
    CHECK (`fecha_fin` IS NULL OR `fecha_fin` >= `fecha_inicio`),
  CONSTRAINT `chk_coord_area_cierre`
    CHECK ((`estado` = 'ACTIVO' AND `fecha_fin` IS NULL) OR (`estado` = 'INACTIVO' AND `fecha_fin` IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ambientes` (
  `id_ambiente` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre_ambiente` VARCHAR(80) NOT NULL,
  `ubicacion` VARCHAR(150) DEFAULT NULL,
  `capacidad` INT DEFAULT NULL,
  `estado` ENUM('ACTIVO', 'MANTENIMIENTO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  PRIMARY KEY (`id_ambiente`),
  UNIQUE KEY `uk_ambientes_nombre` (`nombre_ambiente`),
  CONSTRAINT `chk_ambientes_capacidad`
    CHECK (`capacidad` IS NULL OR `capacidad` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `programas_formacion` (
  `id_programa` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_area` BIGINT UNSIGNED NOT NULL,
  `nombre_programa` VARCHAR(150) NOT NULL,
  PRIMARY KEY (`id_programa`),
  UNIQUE KEY `uk_programas_area_nombre` (`id_area`, `nombre_programa`),
  CONSTRAINT `fk_programas_area`
    FOREIGN KEY (`id_area`)
    REFERENCES `areas_formacion` (`id_area`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `clases_competencias` (
  `id_clase_competencia` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre_competencia` VARCHAR(150) NOT NULL,
  `tipo_competencia` ENUM('FORMATIVA', 'TRANSVERSAL') NOT NULL,
  `estado` ENUM('ACTIVA', 'INACTIVA') NOT NULL DEFAULT 'ACTIVA',
  `creado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_clase_competencia`),
  UNIQUE KEY `uk_clases_competencias_nombre_tipo` (`nombre_competencia`, `tipo_competencia`),
  KEY `idx_clases_competencias_estado_tipo` (`estado`, `tipo_competencia`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `programa_clase_competencia` (
  `id_programa_clase_competencia` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_programa` BIGINT UNSIGNED NOT NULL,
  `id_clase_competencia` BIGINT UNSIGNED NOT NULL,
  `estado` ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  `creado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_programa_clase_competencia`),
  UNIQUE KEY `uk_programa_clase_competencia` (`id_programa`, `id_clase_competencia`),
  KEY `fk_pcc_clase_competencia` (`id_clase_competencia`),
  KEY `idx_pcc_programa_estado` (`id_programa`, `estado`),
  CONSTRAINT `fk_pcc_clase_competencia`
    FOREIGN KEY (`id_clase_competencia`)
    REFERENCES `clases_competencias` (`id_clase_competencia`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_pcc_programa`
    FOREIGN KEY (`id_programa`)
    REFERENCES `programas_formacion` (`id_programa`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `instructores` (
  `id_instructor` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_usuario` BIGINT UNSIGNED NOT NULL,
  `codigo_instructor` VARCHAR(30) DEFAULT NULL,
  `especialidad` VARCHAR(100) DEFAULT NULL,
  `estado` ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  PRIMARY KEY (`id_instructor`),
  UNIQUE KEY `uk_instructores_usuario` (`id_usuario`),
  UNIQUE KEY `uk_instructores_codigo` (`codigo_instructor`),
  CONSTRAINT `fk_instructores_usuario`
    FOREIGN KEY (`id_usuario`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `aprendices` (
  `id_aprendiz` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_usuario` BIGINT UNSIGNED NOT NULL,
  `estado_formativo` ENUM('EN_FORMACION', 'CONDICIONADO', 'CANCELADO', 'APLAZADO', 'CERTIFICADO') NOT NULL DEFAULT 'EN_FORMACION',
  `estado` ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  PRIMARY KEY (`id_aprendiz`),
  UNIQUE KEY `uk_aprendices_usuario` (`id_usuario`),
  CONSTRAINT `fk_aprendices_usuario`
    FOREIGN KEY (`id_usuario`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `grupos_formativos` (
  `id_grupo` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `numero_ficha` VARCHAR(30) NOT NULL,
  `id_programa` BIGINT UNSIGNED NOT NULL,
  `jornada` VARCHAR(30) NOT NULL,
  `fecha_inicio` DATE NOT NULL,
  `fecha_fin` DATE NOT NULL,
  `id_ambiente` BIGINT UNSIGNED DEFAULT NULL,
  `id_instructor_lider` BIGINT UNSIGNED DEFAULT NULL,
  `estado` ENUM('EN_FORMACION', 'PRACTICAS', 'FINALIZADO') NOT NULL DEFAULT 'EN_FORMACION',
  `trimestres` TINYINT UNSIGNED NOT NULL DEFAULT 3,
  PRIMARY KEY (`id_grupo`),
  UNIQUE KEY `uk_grupo_ficha` (`numero_ficha`),
  KEY `fk_grupos_ambiente` (`id_ambiente`),
  KEY `fk_grupos_programa` (`id_programa`),
  KEY `fk_grupos_instructor_lider` (`id_instructor_lider`),
  KEY `idx_grupos_estado_programa` (`estado`, `id_programa`),
  CONSTRAINT `fk_grupos_ambiente`
    FOREIGN KEY (`id_ambiente`)
    REFERENCES `ambientes` (`id_ambiente`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_grupos_programa`
    FOREIGN KEY (`id_programa`)
    REFERENCES `programas_formacion` (`id_programa`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_grupos_instructor_lider`
    FOREIGN KEY (`id_instructor_lider`)
    REFERENCES `instructores` (`id_instructor`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `chk_grupos_fechas`
    CHECK (`fecha_fin` > `fecha_inicio`),
  CONSTRAINT `chk_grupos_trimestres`
    CHECK (`trimestres` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `grupo_trimestre` (
  `id_grupo_trimestre` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_grupo` BIGINT UNSIGNED NOT NULL,
  `numero_trimestre` TINYINT UNSIGNED NOT NULL,
  `fecha_inicio` DATE NOT NULL,
  `fecha_fin` DATE NOT NULL,
  `estado` ENUM('PROGRAMADO', 'ACTIVO', 'COMPLETADO', 'CANCELADO') NOT NULL DEFAULT 'PROGRAMADO',
  `creado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_grupo_trimestre`),
  UNIQUE KEY `uk_grupo_trimestre_numero` (`id_grupo`, `numero_trimestre`),
  KEY `idx_grupo_trimestre_estado` (`id_grupo`, `estado`),
  CONSTRAINT `fk_gt_grupo`
    FOREIGN KEY (`id_grupo`)
    REFERENCES `grupos_formativos` (`id_grupo`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `chk_gt_numero`
    CHECK (`numero_trimestre` > 0),
  CONSTRAINT `chk_gt_fechas`
    CHECK (`fecha_fin` > `fecha_inicio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `instructor_grupo` (
  `id_instructor_grupo` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_instructor` BIGINT UNSIGNED NOT NULL,
  `id_grupo` BIGINT UNSIGNED NOT NULL,
  `estado` ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  `fecha_inicio` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_fin` DATETIME DEFAULT NULL,
  `asignado_por` BIGINT UNSIGNED DEFAULT NULL,
  `motivo_cierre` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id_instructor_grupo`),
  UNIQUE KEY `uk_instructor_grupo_periodo` (`id_instructor`, `id_grupo`, `fecha_inicio`),
  KEY `idx_ig_instructor_grupo_estado` (`id_instructor`, `id_grupo`, `estado`),
  KEY `idx_ig_grupo_estado` (`id_grupo`, `estado`),
  KEY `fk_ig_asignado_por` (`asignado_por`),
  CONSTRAINT `fk_ig_grupo`
    FOREIGN KEY (`id_grupo`)
    REFERENCES `grupos_formativos` (`id_grupo`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_ig_instructor`
    FOREIGN KEY (`id_instructor`)
    REFERENCES `instructores` (`id_instructor`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_ig_asignado_por`
    FOREIGN KEY (`asignado_por`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `chk_ig_fechas`
    CHECK (`fecha_fin` IS NULL OR `fecha_fin` >= `fecha_inicio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `instructor_lider_historial` (
  `id_instructor_lider_historial` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_grupo` BIGINT UNSIGNED NOT NULL,
  `id_instructor` BIGINT UNSIGNED NOT NULL,
  `fecha_inicio` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_fin` DATETIME DEFAULT NULL,
  `asignado_por` BIGINT UNSIGNED DEFAULT NULL,
  `cerrado_por` BIGINT UNSIGNED DEFAULT NULL,
  `motivo` VARCHAR(255) DEFAULT NULL,
  `estado` ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  `lider_activo_grupo_key` BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN `estado` = 'ACTIVO' THEN `id_grupo` ELSE NULL END) VIRTUAL,
  PRIMARY KEY (`id_instructor_lider_historial`),
  UNIQUE KEY `uk_lider_activo_grupo` (`lider_activo_grupo_key`),
  KEY `idx_lider_historial_grupo` (`id_grupo`, `fecha_inicio`),
  KEY `fk_lider_historial_instructor` (`id_instructor`),
  KEY `fk_lider_historial_asignado_por` (`asignado_por`),
  KEY `fk_lider_historial_cerrado_por` (`cerrado_por`),
  CONSTRAINT `fk_lider_historial_grupo`
    FOREIGN KEY (`id_grupo`)
    REFERENCES `grupos_formativos` (`id_grupo`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_lider_historial_instructor`
    FOREIGN KEY (`id_instructor`)
    REFERENCES `instructores` (`id_instructor`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_lider_historial_asignado_por`
    FOREIGN KEY (`asignado_por`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_lider_historial_cerrado_por`
    FOREIGN KEY (`cerrado_por`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `chk_lider_historial_fechas`
    CHECK (`fecha_fin` IS NULL OR `fecha_fin` >= `fecha_inicio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `aprendiz_grupo` (
  `id_aprendiz_grupo` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_aprendiz` BIGINT UNSIGNED NOT NULL,
  `id_grupo` BIGINT UNSIGNED NOT NULL,
  `estado` ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  `fecha_inicio` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_fin` DATETIME DEFAULT NULL,
  `asignado_por` BIGINT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`id_aprendiz_grupo`),
  UNIQUE KEY `uk_aprendiz_grupo_periodo` (`id_aprendiz`, `id_grupo`, `fecha_inicio`),
  KEY `idx_ag_aprendiz_grupo_estado` (`id_aprendiz`, `id_grupo`, `estado`),
  KEY `idx_ag_grupo_estado` (`id_grupo`, `estado`),
  KEY `fk_ag_asignado_por` (`asignado_por`),
  CONSTRAINT `fk_ag_aprendiz`
    FOREIGN KEY (`id_aprendiz`)
    REFERENCES `aprendices` (`id_aprendiz`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_ag_grupo`
    FOREIGN KEY (`id_grupo`)
    REFERENCES `grupos_formativos` (`id_grupo`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_ag_asignado_por`
    FOREIGN KEY (`asignado_por`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `chk_ag_fechas`
    CHECK (`fecha_fin` IS NULL OR `fecha_fin` >= `fecha_inicio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `bloques_jornada` (
  `id_bloque_jornada` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `jornada` ENUM('MANANA', 'TARDE', 'NOCHE', 'SABADO') NOT NULL,
  `nombre_bloque` VARCHAR(80) NOT NULL,
  `orden` TINYINT UNSIGNED NOT NULL,
  `hora_inicio` TIME NOT NULL,
  `hora_fin` TIME NOT NULL,
  `estado` ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  PRIMARY KEY (`id_bloque_jornada`),
  UNIQUE KEY `uk_bloque_jornada_orden` (`jornada`, `orden`),
  UNIQUE KEY `uk_bloque_jornada_horas` (`jornada`, `hora_inicio`, `hora_fin`),
  CONSTRAINT `chk_bloques_orden`
    CHECK (`orden` > 0),
  CONSTRAINT `chk_bloques_horas`
    CHECK (`hora_fin` > `hora_inicio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `horarios_formacion` (
  `id_horario` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_grupo_trimestre` BIGINT UNSIGNED NOT NULL,
  `id_clase_competencia` BIGINT UNSIGNED NOT NULL,
  `id_instructor_grupo` BIGINT UNSIGNED NOT NULL,
  `id_bloque_jornada` BIGINT UNSIGNED NOT NULL,
  `id_ambiente` BIGINT UNSIGNED NOT NULL,
  `dia_semana` TINYINT UNSIGNED NOT NULL COMMENT '1=Lunes ... 7=Domingo',
  `hora_inicio` TIME NOT NULL,
  `hora_fin` TIME NOT NULL,
  `tolerancia_minutos` INT NOT NULL DEFAULT 10,
  `estado` ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  `motivo_inactivacion` VARCHAR(255) DEFAULT NULL,
  `horario_activo_key` TINYINT GENERATED ALWAYS AS (CASE WHEN `estado` = 'ACTIVO' THEN 1 ELSE NULL END) VIRTUAL,
  PRIMARY KEY (`id_horario`),
  UNIQUE KEY `uk_horario_trimestre_dia_bloque` (`id_grupo_trimestre`, `dia_semana`, `id_bloque_jornada`, `horario_activo_key`),
  UNIQUE KEY `uk_horario_ambiente_bloque` (`id_grupo_trimestre`, `id_ambiente`, `dia_semana`, `id_bloque_jornada`, `horario_activo_key`),
  UNIQUE KEY `uk_horario_instructor_bloque` (`id_grupo_trimestre`, `id_instructor_grupo`, `dia_semana`, `id_bloque_jornada`, `horario_activo_key`),
  KEY `fk_horario_clase_competencia` (`id_clase_competencia`),
  KEY `fk_horario_instructor_grupo` (`id_instructor_grupo`),
  KEY `fk_horario_bloque` (`id_bloque_jornada`),
  KEY `fk_horario_ambiente` (`id_ambiente`),
  CONSTRAINT `fk_horario_bloque`
    FOREIGN KEY (`id_bloque_jornada`)
    REFERENCES `bloques_jornada` (`id_bloque_jornada`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_horario_clase_competencia`
    FOREIGN KEY (`id_clase_competencia`)
    REFERENCES `clases_competencias` (`id_clase_competencia`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_horario_grupo_trimestre`
    FOREIGN KEY (`id_grupo_trimestre`)
    REFERENCES `grupo_trimestre` (`id_grupo_trimestre`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_horario_instructor_grupo`
    FOREIGN KEY (`id_instructor_grupo`)
    REFERENCES `instructor_grupo` (`id_instructor_grupo`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_horario_ambiente`
    FOREIGN KEY (`id_ambiente`)
    REFERENCES `ambientes` (`id_ambiente`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `chk_horario_dia_semana`
    CHECK (`dia_semana` BETWEEN 1 AND 7),
  CONSTRAINT `chk_horario_horas`
    CHECK (`hora_fin` > `hora_inicio`),
  CONSTRAINT `chk_horario_tolerancia`
    CHECK (`tolerancia_minutos` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `horario_reg` (
  `id_horario_reg` INT NOT NULL AUTO_INCREMENT,
  `fecha_creacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `id_usuario` BIGINT UNSIGNED NOT NULL,
  `id_horario` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id_horario_reg`),
  KEY `fk_horario_reg_usuarios_idx` (`id_usuario`),
  KEY `fk_horario_reg_horarios_formacion1_idx` (`id_horario`),
  CONSTRAINT `fk_horario_reg_usuarios`
    FOREIGN KEY (`id_usuario`)
    REFERENCES `usuarios` (`id_usuario`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_horario_reg_horarios_formacion1`
    FOREIGN KEY (`id_horario`)
    REFERENCES `horarios_formacion` (`id_horario`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- IoT y biometria
-- =====================================================

CREATE TABLE `dispositivos_iot` (
  `id_dispositivo` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `codigo_dispositivo` VARCHAR(50) NOT NULL,
  `id_ambiente` BIGINT UNSIGNED NOT NULL,
  `tipo_dispositivo` ENUM('ESP32_HUELLA') NOT NULL DEFAULT 'ESP32_HUELLA',
  `estado` ENUM('ACTIVO', 'INACTIVO', 'MANTENIMIENTO') NOT NULL DEFAULT 'ACTIVO',
  `ultima_conexion` DATETIME DEFAULT NULL,
  `ultima_sincronizacion` DATETIME DEFAULT NULL,
  `ultimo_fallo` VARCHAR(255) DEFAULT NULL,
  `fecha_ultimo_fallo` DATETIME DEFAULT NULL,
  `fallos_consecutivos` INT UNSIGNED NOT NULL DEFAULT 0,
  `fecha_recuperacion` DATETIME DEFAULT NULL,
  `creado_por` BIGINT UNSIGNED DEFAULT NULL,
  `actualizado_por` BIGINT UNSIGNED DEFAULT NULL,
  `creado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_dispositivo`),
  UNIQUE KEY `uk_dispositivos_codigo` (`codigo_dispositivo`),
  KEY `idx_dispositivos_ambiente_estado` (`id_ambiente`, `estado`),
  KEY `fk_dispositivos_creado_por` (`creado_por`),
  KEY `fk_dispositivos_actualizado_por` (`actualizado_por`),
  CONSTRAINT `fk_dispositivos_ambiente`
    FOREIGN KEY (`id_ambiente`)
    REFERENCES `ambientes` (`id_ambiente`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_dispositivos_creado_por`
    FOREIGN KEY (`creado_por`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_dispositivos_actualizado_por`
    FOREIGN KEY (`actualizado_por`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `accesos_ambiente` (
  `id_acceso` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_usuario` BIGINT UNSIGNED DEFAULT NULL,
  `id_dispositivo` BIGINT UNSIGNED NOT NULL,
  `tipo_evento` ENUM('ENTRADA', 'SALIDA', 'INTENTO_FALLIDO') NOT NULL,
  `resultado` ENUM('PERMITIDO', 'DENEGADO') NOT NULL,
  `fecha_hora` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `observacion` VARCHAR(255) DEFAULT NULL,
  `sincronizado` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id_acceso`),
  KEY `idx_accesos_fecha` (`fecha_hora`),
  KEY `idx_accesos_dispositivo_fecha` (`id_dispositivo`, `fecha_hora`),
  KEY `fk_accesos_usuario` (`id_usuario`),
  CONSTRAINT `fk_accesos_dispositivo`
    FOREIGN KEY (`id_dispositivo`)
    REFERENCES `dispositivos_iot` (`id_dispositivo`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_accesos_usuario`
    FOREIGN KEY (`id_usuario`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `huellas_biometricas` (
  `id_huella` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_usuario` BIGINT UNSIGNED NOT NULL,
  `id_dispositivo_enrolamiento` BIGINT UNSIGNED DEFAULT NULL,
  `plantilla_biometrica_cifrada` VARBINARY(4096) NOT NULL,
  `plantilla_hash` CHAR(64) NOT NULL,
  `calidad_captura` TINYINT UNSIGNED NOT NULL,
  `dedo` VARCHAR(30) DEFAULT NULL,
  `fecha_enrolamiento` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `enrolado_por` BIGINT UNSIGNED NOT NULL,
  `estado` ENUM('ACTIVA', 'REVOCADA') NOT NULL DEFAULT 'ACTIVA',
  `fecha_revocacion` DATETIME DEFAULT NULL,
  `revocada_por` BIGINT UNSIGNED DEFAULT NULL,
  `motivo_revocacion` VARCHAR(255) DEFAULT NULL,
  `plantilla_activa_hash` CHAR(64) GENERATED ALWAYS AS (CASE WHEN `estado` = 'ACTIVA' THEN `plantilla_hash` ELSE NULL END) VIRTUAL,
  PRIMARY KEY (`id_huella`),
  UNIQUE KEY `uk_huella_activa_hash` (`plantilla_activa_hash`),
  KEY `idx_huellas_usuario_estado` (`id_usuario`, `estado`),
  KEY `fk_hb_dispositivo_enrolamiento` (`id_dispositivo_enrolamiento`),
  KEY `fk_hb_enrolador` (`enrolado_por`),
  KEY `fk_hb_revocada_por` (`revocada_por`),
  CONSTRAINT `fk_hb_dispositivo_enrolamiento`
    FOREIGN KEY (`id_dispositivo_enrolamiento`)
    REFERENCES `dispositivos_iot` (`id_dispositivo`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_hb_enrolador`
    FOREIGN KEY (`enrolado_por`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_hb_revocada_por`
    FOREIGN KEY (`revocada_por`)
    REFERENCES `usuarios` (`id_usuario`),
  CONSTRAINT `fk_hb_usuario`
    FOREIGN KEY (`id_usuario`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `chk_huella_calidad`
    CHECK (`calidad_captura` BETWEEN 0 AND 100),
  CONSTRAINT `chk_huella_revocacion`
    CHECK (
      (`estado` = 'ACTIVA' AND `fecha_revocacion` IS NULL AND `revocada_por` IS NULL AND `motivo_revocacion` IS NULL)
      OR
      (`estado` = 'REVOCADA' AND `fecha_revocacion` IS NOT NULL AND `revocada_por` IS NOT NULL AND `motivo_revocacion` IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `consentimientos_biometricos` (
  `id_consentimiento` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_usuario` BIGINT UNSIGNED NOT NULL,
  `tipo_biometria` ENUM('FACIAL') NOT NULL,
  `version_politica` VARCHAR(40) NOT NULL,
  `aceptado` BOOLEAN NOT NULL DEFAULT TRUE,
  `fecha_aceptacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_revocacion` DATETIME DEFAULT NULL,
  `ip_origen` VARCHAR(45) DEFAULT NULL,
  `user_agent` VARCHAR(255) DEFAULT NULL,
  `creado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_consentimiento`),
  KEY `idx_consentimiento_usuario_tipo` (`id_usuario`, `tipo_biometria`, `aceptado`),
  CONSTRAINT `fk_consentimiento_usuario`
    FOREIGN KEY (`id_usuario`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `chk_consentimiento_revocacion`
    CHECK ((`aceptado` = TRUE AND `fecha_revocacion` IS NULL) OR (`aceptado` = FALSE AND `fecha_revocacion` IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `enrolamientos_faciales` (
  `id_enrolamiento_facial` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_usuario` BIGINT UNSIGNED NOT NULL,
  `id_aprendiz` BIGINT UNSIGNED NOT NULL,
  `id_consentimiento` BIGINT UNSIGNED NOT NULL,
  `estado` ENUM('ACTIVO', 'REVOCADO', 'PENDIENTE_VERIFICACION', 'RECHAZADO') NOT NULL DEFAULT 'ACTIVO',
  `embedding_cifrado` LONGBLOB NOT NULL,
  `embedding_hash` CHAR(64) NOT NULL,
  `modelo_version` VARCHAR(80) NOT NULL,
  `proveedor` VARCHAR(80) NOT NULL DEFAULT 'SIMA_LOCAL_CONTRACT',
  `calidad_captura` TINYINT UNSIGNED DEFAULT NULL,
  `liveness_score` DECIMAL(5,4) DEFAULT NULL,
  `enrolado_por` BIGINT UNSIGNED NOT NULL,
  `fecha_enrolamiento` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revocado_por` BIGINT UNSIGNED DEFAULT NULL,
  `fecha_revocacion` DATETIME DEFAULT NULL,
  `motivo_revocacion` VARCHAR(255) DEFAULT NULL,
  `creado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `aprendiz_activo_key` BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN `estado` = 'ACTIVO' THEN `id_aprendiz` ELSE NULL END) VIRTUAL,
  PRIMARY KEY (`id_enrolamiento_facial`),
  UNIQUE KEY `uk_enrolamiento_facial_activo_aprendiz` (`aprendiz_activo_key`),
  KEY `idx_enrolamiento_facial_usuario_estado` (`id_usuario`, `estado`),
  KEY `idx_enrolamiento_facial_aprendiz_estado` (`id_aprendiz`, `estado`),
  KEY `idx_enrolamiento_facial_hash` (`embedding_hash`),
  KEY `fk_ef_consentimiento` (`id_consentimiento`),
  KEY `fk_ef_enrolado_por` (`enrolado_por`),
  KEY `fk_ef_revocado_por` (`revocado_por`),
  CONSTRAINT `fk_ef_usuario`
    FOREIGN KEY (`id_usuario`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_ef_aprendiz`
    FOREIGN KEY (`id_aprendiz`)
    REFERENCES `aprendices` (`id_aprendiz`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_ef_consentimiento`
    FOREIGN KEY (`id_consentimiento`)
    REFERENCES `consentimientos_biometricos` (`id_consentimiento`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_ef_enrolado_por`
    FOREIGN KEY (`enrolado_por`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_ef_revocado_por`
    FOREIGN KEY (`revocado_por`)
    REFERENCES `usuarios` (`id_usuario`),
  CONSTRAINT `chk_enrolamiento_facial_calidad`
    CHECK (`calidad_captura` IS NULL OR `calidad_captura` BETWEEN 0 AND 100),
  CONSTRAINT `chk_enrolamiento_facial_liveness`
    CHECK (`liveness_score` IS NULL OR (`liveness_score` >= 0 AND `liveness_score` <= 1)),
  CONSTRAINT `chk_enrolamiento_facial_revocacion`
    CHECK (
      (`estado` = 'ACTIVO' AND `fecha_revocacion` IS NULL AND `revocado_por` IS NULL AND `motivo_revocacion` IS NULL)
      OR
      (`estado` <> 'ACTIVO')
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Sesiones, asistencia y seguimiento
-- =====================================================

CREATE TABLE `sesiones_formacion` (
  `id_sesion_formacion` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_horario` BIGINT UNSIGNED NOT NULL,
  `id_grupo_trimestre` BIGINT UNSIGNED NOT NULL,
  `id_clase_competencia` BIGINT UNSIGNED NOT NULL,
  `id_bloque_jornada` BIGINT UNSIGNED NOT NULL,
  `id_grupo` BIGINT UNSIGNED NOT NULL,
  `id_instructor` BIGINT UNSIGNED NOT NULL,
  `id_ambiente` BIGINT UNSIGNED NOT NULL,
  `fecha_clase` DATE NOT NULL,
  `hora_inicio_programada` TIME NOT NULL,
  `hora_fin_programada` TIME NOT NULL,
  `hora_inicio_real` DATETIME DEFAULT NULL,
  `hora_fin_real` DATETIME DEFAULT NULL,
  `estado` ENUM('PROGRAMADA', 'ABIERTA', 'CERRADA', 'CANCELADA') NOT NULL DEFAULT 'PROGRAMADA',
  `origen_apertura` ENUM('AUTOMATICA_LOGIN', 'AUTOMATICA_ACCESO', 'MANUAL_RESPALDO') DEFAULT NULL,
  `id_acceso_apertura` BIGINT UNSIGNED DEFAULT NULL,
  `id_acceso_cierre` BIGINT UNSIGNED DEFAULT NULL,
  `qr_token_hash` VARCHAR(255) DEFAULT NULL,
  `fecha_apertura` DATETIME DEFAULT NULL,
  `fecha_cierre` DATETIME DEFAULT NULL,
  `abierta_por` BIGINT UNSIGNED DEFAULT NULL,
  `cerrada_por` BIGINT UNSIGNED DEFAULT NULL,
  `cancelada_por` BIGINT UNSIGNED DEFAULT NULL,
  `fecha_cancelacion` DATETIME DEFAULT NULL,
  `motivo_cancelacion` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id_sesion_formacion`),
  UNIQUE KEY `uk_sesion_horario_fecha` (`id_horario`, `fecha_clase`),
  KEY `idx_sesion_estado_fecha` (`estado`, `fecha_clase`),
  KEY `idx_sesion_grupo_fecha_estado` (`id_grupo`, `fecha_clase`, `estado`),
  KEY `idx_sesion_instructor_fecha` (`id_instructor`, `fecha_clase`),
  KEY `fk_sesion_grupo_trimestre` (`id_grupo_trimestre`),
  KEY `fk_sesion_clase_competencia` (`id_clase_competencia`),
  KEY `fk_sesion_bloque` (`id_bloque_jornada`),
  KEY `fk_sesion_ambiente` (`id_ambiente`),
  KEY `fk_sesion_apertura` (`id_acceso_apertura`),
  KEY `fk_sesion_cierre` (`id_acceso_cierre`),
  KEY `fk_sesion_abierta_por` (`abierta_por`),
  KEY `fk_sesion_cerrada_por` (`cerrada_por`),
  KEY `fk_sesion_cancelada_por` (`cancelada_por`),
  CONSTRAINT `fk_sesion_horario`
    FOREIGN KEY (`id_horario`)
    REFERENCES `horarios_formacion` (`id_horario`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_sesion_grupo_trimestre`
    FOREIGN KEY (`id_grupo_trimestre`)
    REFERENCES `grupo_trimestre` (`id_grupo_trimestre`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_sesion_clase_competencia`
    FOREIGN KEY (`id_clase_competencia`)
    REFERENCES `clases_competencias` (`id_clase_competencia`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_sesion_bloque`
    FOREIGN KEY (`id_bloque_jornada`)
    REFERENCES `bloques_jornada` (`id_bloque_jornada`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_sesion_grupo`
    FOREIGN KEY (`id_grupo`)
    REFERENCES `grupos_formativos` (`id_grupo`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_sesion_instructor`
    FOREIGN KEY (`id_instructor`)
    REFERENCES `instructores` (`id_instructor`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_sesion_ambiente`
    FOREIGN KEY (`id_ambiente`)
    REFERENCES `ambientes` (`id_ambiente`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_sesion_apertura`
    FOREIGN KEY (`id_acceso_apertura`)
    REFERENCES `accesos_ambiente` (`id_acceso`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_sesion_cierre`
    FOREIGN KEY (`id_acceso_cierre`)
    REFERENCES `accesos_ambiente` (`id_acceso`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_sesion_abierta_por`
    FOREIGN KEY (`abierta_por`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_sesion_cerrada_por`
    FOREIGN KEY (`cerrada_por`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_sesion_cancelada_por`
    FOREIGN KEY (`cancelada_por`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `chk_sesion_horas_programadas`
    CHECK (`hora_fin_programada` > `hora_inicio_programada`),
  CONSTRAINT `chk_sesion_apertura_cierre`
    CHECK (`fecha_cierre` IS NULL OR `fecha_apertura` IS NULL OR `fecha_cierre` >= `fecha_apertura`),
  CONSTRAINT `chk_sesion_cancelacion`
    CHECK ((`estado` <> 'CANCELADA') OR (`fecha_cancelacion` IS NOT NULL AND `motivo_cancelacion` IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `asistencias` (
  `id_asistencia` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_sesion_formacion` BIGINT UNSIGNED NOT NULL,
  `id_aprendiz` BIGINT UNSIGNED NOT NULL,
  `id_acceso` BIGINT UNSIGNED DEFAULT NULL,
  `estado_asistencia` ENUM('PENDIENTE', 'PRESENTE', 'TARDE', 'INASISTENCIA', 'JUSTIFICADO') NOT NULL DEFAULT 'PENDIENTE',
  `hora_registro` TIME DEFAULT NULL,
  `origen` ENUM('QR', 'IOT_HUELLA', 'MANUAL', 'AUTOMATICO_CIERRE', 'JUSTIFICACION', 'CORRECCION') DEFAULT NULL,
  `observacion` VARCHAR(255) DEFAULT NULL,
  `anulada` BOOLEAN NOT NULL DEFAULT FALSE,
  `fecha_anulacion` DATETIME DEFAULT NULL,
  `anulada_por` BIGINT UNSIGNED DEFAULT NULL,
  `motivo_anulacion` VARCHAR(255) DEFAULT NULL,
  `creado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_asistencia`),
  UNIQUE KEY `uk_asistencia_aprendiz_sesion` (`id_aprendiz`, `id_sesion_formacion`),
  KEY `idx_asistencias_sesion_estado` (`id_sesion_formacion`, `estado_asistencia`),
  KEY `idx_asistencias_aprendiz_estado` (`id_aprendiz`, `estado_asistencia`),
  KEY `fk_asistencias_acceso` (`id_acceso`),
  KEY `fk_asistencias_anulada_por` (`anulada_por`),
  CONSTRAINT `fk_asistencias_acceso`
    FOREIGN KEY (`id_acceso`)
    REFERENCES `accesos_ambiente` (`id_acceso`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_asistencias_sesion`
    FOREIGN KEY (`id_sesion_formacion`)
    REFERENCES `sesiones_formacion` (`id_sesion_formacion`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_asistencias_aprendiz`
    FOREIGN KEY (`id_aprendiz`)
    REFERENCES `aprendices` (`id_aprendiz`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_asistencias_anulada_por`
    FOREIGN KEY (`anulada_por`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `chk_asistencia_origen`
    CHECK ((`estado_asistencia` = 'PENDIENTE' AND `origen` IS NULL AND `hora_registro` IS NULL) OR (`estado_asistencia` <> 'PENDIENTE' AND `origen` IS NOT NULL)),
  CONSTRAINT `chk_asistencia_anulacion`
    CHECK ((`anulada` = FALSE AND `fecha_anulacion` IS NULL) OR (`anulada` = TRUE AND `fecha_anulacion` IS NOT NULL AND `motivo_anulacion` IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `intentos_asistencia_iot` (
  `id_intento_iot` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_dispositivo` BIGINT UNSIGNED NOT NULL,
  `id_sesion_formacion` BIGINT UNSIGNED DEFAULT NULL,
  `id_usuario` BIGINT UNSIGNED DEFAULT NULL,
  `id_asistencia` BIGINT UNSIGNED DEFAULT NULL,
  `tipo_intento` ENUM('ASISTENCIA', 'ENROLAMIENTO', 'REVOCACION', 'CONEXION', 'SINCRONIZACION', 'FALLO') NOT NULL,
  `resultado` ENUM('EXITOSO', 'FALLIDO', 'RECHAZADO', 'RECUPERADO') NOT NULL,
  `calidad_captura` TINYINT UNSIGNED DEFAULT NULL,
  `evento_uuid` VARCHAR(36) NOT NULL,
  `nonce` VARCHAR(120) NOT NULL,
  `firma_evento` VARCHAR(255) NOT NULL,
  `fecha_origen` DATETIME NOT NULL,
  `expira_en` DATETIME NOT NULL,
  `motivo` VARCHAR(120) DEFAULT NULL,
  `detalle` VARCHAR(500) DEFAULT NULL,
  `fecha_evento` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_intento_iot`),
  UNIQUE KEY `uk_intentos_iot_evento_uuid` (`evento_uuid`),
  UNIQUE KEY `uk_intentos_iot_nonce` (`nonce`),
  KEY `idx_intentos_iot_dispositivo_fecha` (`id_dispositivo`, `fecha_evento`),
  KEY `idx_intentos_iot_sesion` (`id_sesion_formacion`),
  KEY `idx_intentos_iot_usuario_fecha` (`id_usuario`, `fecha_evento`),
  KEY `fk_intentos_iot_asistencia` (`id_asistencia`),
  CONSTRAINT `fk_intentos_iot_dispositivo`
    FOREIGN KEY (`id_dispositivo`)
    REFERENCES `dispositivos_iot` (`id_dispositivo`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_intentos_iot_sesion`
    FOREIGN KEY (`id_sesion_formacion`)
    REFERENCES `sesiones_formacion` (`id_sesion_formacion`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_intentos_iot_usuario`
    FOREIGN KEY (`id_usuario`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_intentos_iot_asistencia`
    FOREIGN KEY (`id_asistencia`)
    REFERENCES `asistencias` (`id_asistencia`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `chk_intentos_iot_calidad`
    CHECK (`calidad_captura` IS NULL OR `calidad_captura` BETWEEN 0 AND 100),
  CONSTRAINT `chk_intentos_iot_ventana`
    CHECK (`expira_en` > `fecha_origen`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `evidencias_asistencia` (
  `id_evidencia_asistencia` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_asistencia` BIGINT UNSIGNED NOT NULL,
  `metodo` ENUM('QR', 'IOT_HUELLA', 'MANUAL', 'BIOMETRIA_MOVIL', 'GEOLOCALIZACION', 'FACIAL_SIMA', 'CORRECCION', 'JUSTIFICACION') NOT NULL,
  `resultado` ENUM('APROBADA', 'RECHAZADA', 'PENDIENTE') NOT NULL DEFAULT 'APROBADA',
  `fecha_registro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `id_usuario_registra` BIGINT UNSIGNED DEFAULT NULL,
  `id_dispositivo` BIGINT UNSIGNED DEFAULT NULL,
  `id_acceso` BIGINT UNSIGNED DEFAULT NULL,
  `id_intento_iot` BIGINT UNSIGNED DEFAULT NULL,
  `qr_token_hash` VARCHAR(255) DEFAULT NULL,
  `latitud` DECIMAL(10,8) DEFAULT NULL,
  `longitud` DECIMAL(11,8) DEFAULT NULL,
  `precision_metros` DECIMAL(8,2) DEFAULT NULL,
  `distancia_metros` DECIMAL(8,2) DEFAULT NULL,
  `dentro_rango` TINYINT(1) DEFAULT NULL,
  `detalle` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id_evidencia_asistencia`),
  KEY `idx_evidencia_asistencia_metodo` (`id_asistencia`, `metodo`),
  KEY `idx_evidencia_metodo_resultado_fecha` (`metodo`, `resultado`, `fecha_registro`),
  KEY `fk_evidencia_usuario` (`id_usuario_registra`),
  KEY `fk_evidencia_dispositivo` (`id_dispositivo`),
  KEY `fk_evidencia_acceso` (`id_acceso`),
  KEY `fk_evidencia_intento_iot` (`id_intento_iot`),
  CONSTRAINT `fk_evidencia_asistencia`
    FOREIGN KEY (`id_asistencia`)
    REFERENCES `asistencias` (`id_asistencia`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_evidencia_usuario`
    FOREIGN KEY (`id_usuario_registra`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_evidencia_dispositivo`
    FOREIGN KEY (`id_dispositivo`)
    REFERENCES `dispositivos_iot` (`id_dispositivo`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_evidencia_acceso`
    FOREIGN KEY (`id_acceso`)
    REFERENCES `accesos_ambiente` (`id_acceso`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_evidencia_intento_iot`
    FOREIGN KEY (`id_intento_iot`)
    REFERENCES `intentos_asistencia_iot` (`id_intento_iot`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `chk_evidencia_latitud`
    CHECK (`latitud` IS NULL OR (`latitud` >= -90 AND `latitud` <= 90)),
  CONSTRAINT `chk_evidencia_longitud`
    CHECK (`longitud` IS NULL OR (`longitud` >= -180 AND `longitud` <= 180)),
  CONSTRAINT `chk_evidencia_precision`
    CHECK (`precision_metros` IS NULL OR `precision_metros` >= 0),
  CONSTRAINT `chk_evidencia_distancia`
    CHECK (`distancia_metros` IS NULL OR `distancia_metros` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `intentos_validacion_facial` (
  `id_intento_facial` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_usuario` BIGINT UNSIGNED NOT NULL,
  `id_aprendiz` BIGINT UNSIGNED NOT NULL,
  `id_sesion_formacion` BIGINT UNSIGNED DEFAULT NULL,
  `id_asistencia` BIGINT UNSIGNED DEFAULT NULL,
  `id_enrolamiento_facial` BIGINT UNSIGNED DEFAULT NULL,
  `resultado` ENUM('APROBADO', 'RECHAZADO', 'NO_DISPONIBLE', 'LIVENESS_FALLIDO', 'ERROR') NOT NULL,
  `motivo` VARCHAR(120) DEFAULT NULL,
  `proveedor` VARCHAR(80) DEFAULT NULL,
  `modelo_version` VARCHAR(80) DEFAULT NULL,
  `score_match` DECIMAL(6,5) DEFAULT NULL,
  `liveness_result` ENUM('PASSED', 'BASIC_PASSED', 'FAILED', 'NOT_AVAILABLE') NOT NULL DEFAULT 'NOT_AVAILABLE',
  `device_uuid` VARCHAR(120) NOT NULL,
  `challenge_nonce` VARCHAR(120) NOT NULL,
  `fecha_intento` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `detalle` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id_intento_facial`),
  UNIQUE KEY `uk_intento_facial_nonce` (`challenge_nonce`),
  KEY `idx_intento_facial_usuario_sesion` (`id_usuario`, `id_sesion_formacion`, `fecha_intento`),
  KEY `idx_intento_facial_aprendiz_resultado` (`id_aprendiz`, `resultado`, `fecha_intento`),
  KEY `fk_if_sesion` (`id_sesion_formacion`),
  KEY `fk_if_asistencia` (`id_asistencia`),
  KEY `fk_if_enrolamiento` (`id_enrolamiento_facial`),
  CONSTRAINT `fk_if_usuario`
    FOREIGN KEY (`id_usuario`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_if_aprendiz`
    FOREIGN KEY (`id_aprendiz`)
    REFERENCES `aprendices` (`id_aprendiz`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_if_sesion`
    FOREIGN KEY (`id_sesion_formacion`)
    REFERENCES `sesiones_formacion` (`id_sesion_formacion`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_if_asistencia`
    FOREIGN KEY (`id_asistencia`)
    REFERENCES `asistencias` (`id_asistencia`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_if_enrolamiento`
    FOREIGN KEY (`id_enrolamiento_facial`)
    REFERENCES `enrolamientos_faciales` (`id_enrolamiento_facial`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `chk_intento_facial_score`
    CHECK (`score_match` IS NULL OR (`score_match` >= 0 AND `score_match` <= 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `justificaciones_asistencia` (
  `id_justificacion` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_asistencia` BIGINT UNSIGNED NOT NULL,
  `id_aprendiz` BIGINT UNSIGNED NOT NULL,
  `archivo_url` VARCHAR(255) NOT NULL,
  `archivo_nombre_original` VARCHAR(180) NOT NULL,
  `archivo_mime` VARCHAR(80) NOT NULL,
  `archivo_tamano_bytes` INT UNSIGNED NOT NULL,
  `archivo_hash` CHAR(64) NOT NULL,
  `comentario_aprendiz` TEXT DEFAULT NULL,
  `estado` ENUM('PENDIENTE', 'APROBADA', 'RECHAZADA') NOT NULL DEFAULT 'PENDIENTE',
  `fecha_envio` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revisada_por` BIGINT UNSIGNED DEFAULT NULL,
  `fecha_revision` DATETIME DEFAULT NULL,
  `comentario_instructor` TEXT DEFAULT NULL,
  PRIMARY KEY (`id_justificacion`),
  UNIQUE KEY `uk_justificacion_asistencia` (`id_asistencia`),
  KEY `fk_just_aprendiz` (`id_aprendiz`),
  KEY `fk_just_instructor` (`revisada_por`),
  CONSTRAINT `fk_just_aprendiz`
    FOREIGN KEY (`id_aprendiz`)
    REFERENCES `aprendices` (`id_aprendiz`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_just_asistencia`
    FOREIGN KEY (`id_asistencia`)
    REFERENCES `asistencias` (`id_asistencia`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_just_instructor`
    FOREIGN KEY (`revisada_por`)
    REFERENCES `instructores` (`id_instructor`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `chk_just_archivo_tamano`
    CHECK (`archivo_tamano_bytes` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `observaciones` (
  `id_observacion` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_aprendiz` BIGINT UNSIGNED NOT NULL,
  `id_grupo` BIGINT UNSIGNED NOT NULL,
  `id_instructor` BIGINT UNSIGNED NOT NULL,
  `id_sesion_formacion` BIGINT UNSIGNED DEFAULT NULL,
  `tipo_observacion` ENUM('ACADEMICA', 'CONVIVENCIAL') NOT NULL,
  `severidad` ENUM('LEVE', 'MODERADA', 'GRAVE') NOT NULL DEFAULT 'MODERADA',
  `origen` ENUM('MANUAL', 'AUTOMATICO') NOT NULL DEFAULT 'MANUAL',
  `descripcion` TEXT NOT NULL,
  `fecha_observacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_cierre` DATETIME DEFAULT NULL,
  `estado` ENUM('ABIERTA', 'CERRADA') NOT NULL DEFAULT 'ABIERTA',
  `anulada` BOOLEAN NOT NULL DEFAULT FALSE,
  `fecha_anulacion` DATETIME DEFAULT NULL,
  `anulada_por` BIGINT UNSIGNED DEFAULT NULL,
  `motivo_anulacion` VARCHAR(255) DEFAULT NULL,
  `observacion_automatica_key` BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN `origen` = 'AUTOMATICO' THEN `id_sesion_formacion` ELSE NULL END) VIRTUAL,
  PRIMARY KEY (`id_observacion`),
  UNIQUE KEY `uk_obs_auto_aprendiz_sesion` (`id_aprendiz`, `observacion_automatica_key`),
  KEY `idx_obs_aprendiz_grupo_estado` (`id_aprendiz`, `id_grupo`, `estado`),
  KEY `idx_obs_grupo_fecha` (`id_grupo`, `fecha_observacion`),
  KEY `fk_obs_instructor` (`id_instructor`),
  KEY `fk_obs_sesion` (`id_sesion_formacion`),
  KEY `fk_obs_anulada_por` (`anulada_por`),
  CONSTRAINT `fk_obs_aprendiz`
    FOREIGN KEY (`id_aprendiz`)
    REFERENCES `aprendices` (`id_aprendiz`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_obs_grupo`
    FOREIGN KEY (`id_grupo`)
    REFERENCES `grupos_formativos` (`id_grupo`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_obs_instructor`
    FOREIGN KEY (`id_instructor`)
    REFERENCES `instructores` (`id_instructor`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_obs_sesion`
    FOREIGN KEY (`id_sesion_formacion`)
    REFERENCES `sesiones_formacion` (`id_sesion_formacion`),
  CONSTRAINT `fk_obs_anulada_por`
    FOREIGN KEY (`anulada_por`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `chk_obs_auto_sesion`
    CHECK ((`origen` = 'AUTOMATICO' AND `id_sesion_formacion` IS NOT NULL) OR (`origen` = 'MANUAL')),
  CONSTRAINT `chk_obs_anulacion`
    CHECK ((`anulada` = FALSE AND `fecha_anulacion` IS NULL) OR (`anulada` = TRUE AND `fecha_anulacion` IS NOT NULL AND `motivo_anulacion` IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `alertas` (
  `id_alerta` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_aprendiz` BIGINT UNSIGNED NOT NULL,
  `id_grupo` BIGINT UNSIGNED NOT NULL,
  `tipo_alerta` ENUM('ASISTENCIAL', 'OBSERVACIONES_RECURRENTES', 'CONVIVENCIAL') NOT NULL,
  `regla_disparo` ENUM('3_CONSECUTIVAS', '5_TRIMESTRE', 'OBSERVACIONES_RECURRENTES', 'MANUAL') DEFAULT NULL,
  `origen` ENUM('AUTOMATICA', 'MANUAL') NOT NULL,
  `severidad` ENUM('LEVE', 'MODERADA', 'GRAVE', 'CRITICA') NOT NULL DEFAULT 'MODERADA',
  `descripcion` TEXT NOT NULL,
  `estado` ENUM('ABIERTA', 'CERRADA') NOT NULL DEFAULT 'ABIERTA',
  `fecha_alerta` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_inicio_evaluada` DATE DEFAULT NULL,
  `fecha_fin_evaluada` DATE DEFAULT NULL,
  `fecha_ultima_evaluacion` DATETIME DEFAULT NULL,
  `creada_por` BIGINT UNSIGNED DEFAULT NULL,
  `justificacion_cierre` TEXT DEFAULT NULL,
  `fecha_cierre` DATETIME DEFAULT NULL,
  `cerrada_por` BIGINT UNSIGNED DEFAULT NULL,
  `justificacion_reapertura` TEXT DEFAULT NULL,
  `fecha_reapertura` DATETIME DEFAULT NULL,
  `reabierta_por` BIGINT UNSIGNED DEFAULT NULL,
  `alerta_abierta_key` TINYINT GENERATED ALWAYS AS (CASE WHEN `estado` = 'ABIERTA' THEN 1 ELSE NULL END) VIRTUAL,
  PRIMARY KEY (`id_alerta`),
  UNIQUE KEY `uk_alerta_abierta_tipo` (`id_aprendiz`, `id_grupo`, `tipo_alerta`, `alerta_abierta_key`),
  KEY `idx_alertas_grupo_estado_tipo` (`id_grupo`, `estado`, `tipo_alerta`),
  KEY `idx_alertas_aprendiz_estado` (`id_aprendiz`, `estado`),
  KEY `fk_alertas_creada_por` (`creada_por`),
  KEY `fk_alertas_cerrada_por` (`cerrada_por`),
  KEY `fk_alertas_reabierta_por` (`reabierta_por`),
  CONSTRAINT `fk_alertas_aprendiz`
    FOREIGN KEY (`id_aprendiz`)
    REFERENCES `aprendices` (`id_aprendiz`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_alertas_grupo`
    FOREIGN KEY (`id_grupo`)
    REFERENCES `grupos_formativos` (`id_grupo`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_alertas_creada_por`
    FOREIGN KEY (`creada_por`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_alertas_cerrada_por`
    FOREIGN KEY (`cerrada_por`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_alertas_reabierta_por`
    FOREIGN KEY (`reabierta_por`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `chk_alerta_cierre`
    CHECK ((`estado` = 'ABIERTA') OR (`estado` = 'CERRADA' AND `fecha_cierre` IS NOT NULL AND `justificacion_cierre` IS NOT NULL)),
  CONSTRAINT `chk_alerta_reapertura`
    CHECK (`fecha_reapertura` IS NULL OR `justificacion_reapertura` IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `alerta_observaciones` (
  `id_alerta_observacion` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_alerta` BIGINT UNSIGNED NOT NULL,
  `id_observacion` BIGINT UNSIGNED NOT NULL,
  `asociada_por` BIGINT UNSIGNED NOT NULL,
  `fecha_asociacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_alerta_observacion`),
  UNIQUE KEY `uk_alerta_observacion_obs` (`id_observacion`),
  KEY `fk_alerta_obs_alerta` (`id_alerta`),
  KEY `fk_alerta_obs_usuario` (`asociada_por`),
  CONSTRAINT `fk_alerta_obs_alerta`
    FOREIGN KEY (`id_alerta`)
    REFERENCES `alertas` (`id_alerta`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_alerta_obs_observacion`
    FOREIGN KEY (`id_observacion`)
    REFERENCES `observaciones` (`id_observacion`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_alerta_obs_usuario`
    FOREIGN KEY (`asociada_por`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `notificaciones` (
  `id_notificacion` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_usuario` BIGINT UNSIGNED NOT NULL,
  `id_alerta` BIGINT UNSIGNED DEFAULT NULL,
  `id_observacion` BIGINT UNSIGNED DEFAULT NULL,
  `id_sesion_formacion` BIGINT UNSIGNED DEFAULT NULL,
  `id_justificacion` BIGINT UNSIGNED DEFAULT NULL,
  `id_intento_iot` BIGINT UNSIGNED DEFAULT NULL,
  `titulo` VARCHAR(120) NOT NULL,
  `mensaje` VARCHAR(255) NOT NULL,
  `tipo` ENUM('ALERTA', 'OBSERVACION', 'ASISTENCIA', 'SESION', 'JUSTIFICACION', 'IOT', 'SISTEMA') NOT NULL,
  `leida` TINYINT(1) NOT NULL DEFAULT 0,
  `fecha_envio` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_lectura` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id_notificacion`),
  KEY `idx_notificaciones_usuario_leida_fecha` (`id_usuario`, `leida`, `fecha_envio`),
  KEY `fk_notificaciones_alerta` (`id_alerta`),
  KEY `fk_notificaciones_observacion` (`id_observacion`),
  KEY `fk_notificaciones_sesion` (`id_sesion_formacion`),
  KEY `fk_notificaciones_justificacion` (`id_justificacion`),
  KEY `fk_notificaciones_intento_iot` (`id_intento_iot`),
  CONSTRAINT `fk_notificaciones_usuario`
    FOREIGN KEY (`id_usuario`)
    REFERENCES `usuarios` (`id_usuario`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_notificaciones_alerta`
    FOREIGN KEY (`id_alerta`)
    REFERENCES `alertas` (`id_alerta`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_notificaciones_observacion`
    FOREIGN KEY (`id_observacion`)
    REFERENCES `observaciones` (`id_observacion`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_notificaciones_sesion`
    FOREIGN KEY (`id_sesion_formacion`)
    REFERENCES `sesiones_formacion` (`id_sesion_formacion`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_notificaciones_justificacion`
    FOREIGN KEY (`id_justificacion`)
    REFERENCES `justificaciones_asistencia` (`id_justificacion`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_notificaciones_intento_iot`
    FOREIGN KEY (`id_intento_iot`)
    REFERENCES `intentos_asistencia_iot` (`id_intento_iot`)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP VIEW IF EXISTS `vw_inasistencias_validas`;

CREATE VIEW `vw_inasistencias_validas` AS
SELECT
    a.`id_asistencia`,
    a.`id_aprendiz`,
    a.`id_sesion_formacion`,
    s.`id_grupo`,
    s.`id_horario`,
    s.`id_grupo_trimestre`,
    s.`id_clase_competencia`,
    s.`id_bloque_jornada`,
    s.`fecha_clase`,
    a.`estado_asistencia`
FROM `asistencias` a
JOIN `sesiones_formacion` s
    ON s.`id_sesion_formacion` = a.`id_sesion_formacion`
LEFT JOIN `justificaciones_asistencia` j
    ON j.`id_asistencia` = a.`id_asistencia`
   AND j.`estado` = 'APROBADA'
WHERE a.`estado_asistencia` = 'INASISTENCIA'
  AND a.`anulada` = FALSE
  AND s.`estado` <> 'CANCELADA'
  AND j.`id_justificacion` IS NULL;

DELIMITER $$

CREATE TRIGGER `trg_proteger_ultimo_superadmin_upd`
BEFORE UPDATE ON `usuarios`
FOR EACH ROW
BEGIN
    DECLARE v_rol_anterior VARCHAR(50);
    DECLARE v_superadmins_activos INT DEFAULT 0;

    SELECT `nombre`
      INTO v_rol_anterior
      FROM `roles`
     WHERE `id_rol` = OLD.`id_rol`;

    IF v_rol_anterior = 'SUPER_ADMIN'
       AND OLD.`estado` = 'ACTIVO'
       AND (NEW.`estado` <> 'ACTIVO' OR NEW.`id_rol` <> OLD.`id_rol`) THEN
        SELECT COUNT(*)
          INTO v_superadmins_activos
          FROM `usuarios` u
          JOIN `roles` r ON r.`id_rol` = u.`id_rol`
         WHERE r.`nombre` = 'SUPER_ADMIN'
           AND u.`estado` = 'ACTIVO'
           AND u.`id_usuario` <> OLD.`id_usuario`;

        IF v_superadmins_activos = 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede desactivar, bloquear o cambiar el rol del ultimo SUPER_ADMIN activo';
        END IF;
    END IF;
END$$

CREATE TRIGGER `trg_proteger_ultimo_superadmin_del`
BEFORE DELETE ON `usuarios`
FOR EACH ROW
BEGIN
    DECLARE v_rol_anterior VARCHAR(50);
    DECLARE v_superadmins_activos INT DEFAULT 0;

    SELECT `nombre`
      INTO v_rol_anterior
      FROM `roles`
     WHERE `id_rol` = OLD.`id_rol`;

    IF v_rol_anterior = 'SUPER_ADMIN' AND OLD.`estado` = 'ACTIVO' THEN
        SELECT COUNT(*)
          INTO v_superadmins_activos
          FROM `usuarios` u
          JOIN `roles` r ON r.`id_rol` = u.`id_rol`
         WHERE r.`nombre` = 'SUPER_ADMIN'
           AND u.`estado` = 'ACTIVO'
           AND u.`id_usuario` <> OLD.`id_usuario`;

        IF v_superadmins_activos = 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede eliminar el ultimo SUPER_ADMIN activo';
        END IF;
    END IF;
END$$

CREATE TRIGGER `trg_no_eliminar_observaciones`
BEFORE DELETE ON `observaciones`
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Las observaciones registradas no pueden eliminarse del historial';
END$$

CREATE TRIGGER `trg_validar_anulacion_observacion`
BEFORE UPDATE ON `observaciones`
FOR EACH ROW
BEGIN
    DECLARE v_escalada INT DEFAULT 0;

    IF OLD.`anulada` = FALSE AND NEW.`anulada` = TRUE THEN
        SELECT COUNT(*)
          INTO v_escalada
          FROM `alerta_observaciones`
         WHERE `id_observacion` = OLD.`id_observacion`;

        IF OLD.`estado` <> 'ABIERTA' OR v_escalada > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Solo se pueden anular observaciones abiertas y no asociadas a alertas';
        END IF;

        IF NEW.`fecha_anulacion` IS NULL
           OR NEW.`anulada_por` IS NULL
           OR NEW.`motivo_anulacion` IS NULL THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La anulacion de observacion requiere fecha, responsable y motivo';
        END IF;
    END IF;

    IF OLD.`anulada` = TRUE AND NEW.`anulada` = FALSE THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Una observacion anulada no puede reactivarse';
    END IF;
END$$

CREATE TRIGGER `trg_cerrar_observacion_al_escalar`
AFTER INSERT ON `alerta_observaciones`
FOR EACH ROW
BEGIN
    UPDATE `observaciones`
       SET `estado` = 'CERRADA',
           `fecha_cierre` = COALESCE(`fecha_cierre`, CURRENT_TIMESTAMP)
     WHERE `id_observacion` = NEW.`id_observacion`
       AND `estado` = 'ABIERTA'
       AND `anulada` = FALSE;
END$$

CREATE TRIGGER `trg_validar_grupo_trimestre_activo_ins`
BEFORE INSERT ON `grupo_trimestre`
FOR EACH ROW
BEGIN
    DECLARE v_activos INT DEFAULT 0;
    IF NEW.`estado` = 'ACTIVO' THEN
        SELECT COUNT(*)
          INTO v_activos
          FROM `grupo_trimestre`
         WHERE `id_grupo` = NEW.`id_grupo`
           AND `estado` = 'ACTIVO';
        IF v_activos > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Solo puede existir un trimestre activo por grupo';
        END IF;
    END IF;
END$$

CREATE TRIGGER `trg_validar_grupo_trimestre_activo_upd`
BEFORE UPDATE ON `grupo_trimestre`
FOR EACH ROW
BEGIN
    DECLARE v_activos INT DEFAULT 0;
    IF NEW.`estado` = 'ACTIVO' THEN
        SELECT COUNT(*)
          INTO v_activos
          FROM `grupo_trimestre`
         WHERE `id_grupo` = NEW.`id_grupo`
           AND `estado` = 'ACTIVO'
           AND `id_grupo_trimestre` <> OLD.`id_grupo_trimestre`;
        IF v_activos > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Solo puede existir un trimestre activo por grupo';
        END IF;
    END IF;
END$$

CREATE TRIGGER `trg_validar_horario_formacion_ins`
BEFORE INSERT ON `horarios_formacion`
FOR EACH ROW
BEGIN
    DECLARE v_valido INT DEFAULT 0;

    SELECT COUNT(*)
      INTO v_valido
      FROM `grupo_trimestre` gt
      JOIN `grupos_formativos` g ON g.`id_grupo` = gt.`id_grupo`
      JOIN `programa_clase_competencia` pcc
        ON pcc.`id_programa` = g.`id_programa`
       AND pcc.`id_clase_competencia` = NEW.`id_clase_competencia`
       AND pcc.`estado` = 'ACTIVO'
      JOIN `instructor_grupo` ig
        ON ig.`id_instructor_grupo` = NEW.`id_instructor_grupo`
       AND ig.`id_grupo` = gt.`id_grupo`
       AND ig.`estado` = 'ACTIVO'
     WHERE gt.`id_grupo_trimestre` = NEW.`id_grupo_trimestre`
       AND gt.`estado` IN ('PROGRAMADO', 'ACTIVO')
       AND g.`estado` = 'EN_FORMACION';

    IF v_valido = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'El horario requiere grupo en formacion, trimestre habilitado, competencia activa e instructor vinculado';
    END IF;
END$$

CREATE TRIGGER `trg_validar_horario_formacion_upd`
BEFORE UPDATE ON `horarios_formacion`
FOR EACH ROW
BEGIN
    DECLARE v_valido INT DEFAULT 0;

    SELECT COUNT(*)
      INTO v_valido
      FROM `grupo_trimestre` gt
      JOIN `grupos_formativos` g ON g.`id_grupo` = gt.`id_grupo`
      JOIN `programa_clase_competencia` pcc
        ON pcc.`id_programa` = g.`id_programa`
       AND pcc.`id_clase_competencia` = NEW.`id_clase_competencia`
       AND pcc.`estado` = 'ACTIVO'
      JOIN `instructor_grupo` ig
        ON ig.`id_instructor_grupo` = NEW.`id_instructor_grupo`
       AND ig.`id_grupo` = gt.`id_grupo`
       AND ig.`estado` = 'ACTIVO'
     WHERE gt.`id_grupo_trimestre` = NEW.`id_grupo_trimestre`
       AND gt.`estado` IN ('PROGRAMADO', 'ACTIVO')
       AND g.`estado` = 'EN_FORMACION';

    IF v_valido = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'El horario requiere grupo en formacion, trimestre habilitado, competencia activa e instructor vinculado';
    END IF;
END$$

CREATE TRIGGER `trg_validar_asistencia_ins`
BEFORE INSERT ON `asistencias`
FOR EACH ROW
BEGIN
    DECLARE v_estado_sesion VARCHAR(20);

    SELECT `estado`
      INTO v_estado_sesion
      FROM `sesiones_formacion`
     WHERE `id_sesion_formacion` = NEW.`id_sesion_formacion`
     LIMIT 1;

    IF v_estado_sesion = 'CANCELADA' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No se puede registrar asistencia en una sesion cancelada';
    END IF;

    IF NEW.`estado_asistencia` IN ('PRESENTE', 'TARDE')
       AND NEW.`origen` IN ('QR', 'IOT_HUELLA', 'MANUAL')
       AND v_estado_sesion <> 'ABIERTA' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Las marcas de asistencia solo se registran en sesiones abiertas';
    END IF;

END$$

CREATE TRIGGER `trg_validar_asistencia_upd`
BEFORE UPDATE ON `asistencias`
FOR EACH ROW
BEGIN
    DECLARE v_estado_sesion VARCHAR(20);

    SELECT `estado`
      INTO v_estado_sesion
      FROM `sesiones_formacion`
     WHERE `id_sesion_formacion` = NEW.`id_sesion_formacion`
     LIMIT 1;

    IF v_estado_sesion = 'CANCELADA' AND NEW.`anulada` = FALSE THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Las asistencias de una sesion cancelada deben permanecer anuladas';
    END IF;

    IF NEW.`estado_asistencia` IN ('PRESENTE', 'TARDE')
       AND NEW.`origen` IN ('QR', 'IOT_HUELLA', 'MANUAL')
       AND v_estado_sesion <> 'ABIERTA' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Las marcas de asistencia solo se registran en sesiones abiertas';
    END IF;

END$$

CREATE TRIGGER `trg_validar_justificacion_aprendiz_ins`
BEFORE INSERT ON `justificaciones_asistencia`
FOR EACH ROW
BEGIN
    DECLARE v_id_aprendiz BIGINT UNSIGNED;
    SELECT `id_aprendiz`
      INTO v_id_aprendiz
      FROM `asistencias`
     WHERE `id_asistencia` = NEW.`id_asistencia`
     LIMIT 1;
    IF v_id_aprendiz IS NULL OR v_id_aprendiz <> NEW.`id_aprendiz` THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'La justificacion debe pertenecer al aprendiz de la asistencia';
    END IF;
END$$

CREATE TRIGGER `trg_validar_justificacion_aprendiz_upd`
BEFORE UPDATE ON `justificaciones_asistencia`
FOR EACH ROW
BEGIN
    DECLARE v_id_aprendiz BIGINT UNSIGNED;
    SELECT `id_aprendiz`
      INTO v_id_aprendiz
      FROM `asistencias`
     WHERE `id_asistencia` = NEW.`id_asistencia`
     LIMIT 1;
    IF v_id_aprendiz IS NULL OR v_id_aprendiz <> NEW.`id_aprendiz` THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'La justificacion debe pertenecer al aprendiz de la asistencia';
    END IF;
END$$

CREATE TRIGGER `trg_validar_huella_ins`
BEFORE INSERT ON `huellas_biometricas`
FOR EACH ROW
BEGIN
    DECLARE v_estado_usuario VARCHAR(20);
    DECLARE v_huellas_activas INT DEFAULT 0;

    SELECT `estado`
      INTO v_estado_usuario
      FROM `usuarios`
     WHERE `id_usuario` = NEW.`id_usuario`;

    IF v_estado_usuario IS NULL OR v_estado_usuario <> 'ACTIVO' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Usuario inactivo no puede enrolar huella';
    END IF;

    IF NEW.`estado` = 'ACTIVA' THEN
        SELECT COUNT(*)
          INTO v_huellas_activas
          FROM `huellas_biometricas`
         WHERE `id_usuario` = NEW.`id_usuario`
           AND `estado` = 'ACTIVA';
        IF v_huellas_activas >= 2 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Un usuario no puede tener mas de dos huellas activas';
        END IF;
    END IF;
END$$

CREATE TRIGGER `trg_validar_huella_upd`
BEFORE UPDATE ON `huellas_biometricas`
FOR EACH ROW
BEGIN
    DECLARE v_huellas_activas INT DEFAULT 0;

    IF NEW.`estado` = 'ACTIVA' THEN
        SELECT COUNT(*)
          INTO v_huellas_activas
          FROM `huellas_biometricas`
          WHERE `id_usuario` = NEW.`id_usuario`
            AND `estado` = 'ACTIVA'
            AND `id_huella` <> OLD.`id_huella`;
        IF v_huellas_activas >= 2 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Un usuario no puede tener mas de dos huellas activas';
        END IF;
    END IF;
END$$

CREATE TRIGGER `trg_validar_acceso_permitido`
BEFORE INSERT ON `accesos_ambiente`
FOR EACH ROW
BEGIN
    DECLARE v_estado VARCHAR(20);
    DECLARE v_tiene_huella INT DEFAULT 0;
    DECLARE v_estado_dispositivo VARCHAR(20);

    SELECT `estado`
      INTO v_estado_dispositivo
      FROM `dispositivos_iot`
     WHERE `id_dispositivo` = NEW.`id_dispositivo`;

    IF v_estado_dispositivo <> 'ACTIVO' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'El dispositivo no esta activo';
    END IF;

    IF NEW.`resultado` = 'PERMITIDO' AND NEW.`id_usuario` IS NOT NULL THEN
        SELECT `estado`
          INTO v_estado
          FROM `usuarios`
         WHERE `id_usuario` = NEW.`id_usuario`;

        IF v_estado IS NULL OR v_estado <> 'ACTIVO' THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se permite acceso a usuarios inactivos';
        END IF;

        SELECT COUNT(*)
          INTO v_tiene_huella
          FROM `huellas_biometricas`
         WHERE `id_usuario` = NEW.`id_usuario`
           AND `estado` = 'ACTIVA';

        IF v_tiene_huella = 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El usuario no tiene huella activa enrolada';
        END IF;
    END IF;
END$$

DELIMITER ;

-- =====================================================
-- Datos iniciales coherentes con el backlog actualizado
-- =====================================================

INSERT INTO `roles` (`nombre`, `descripcion`) VALUES
('SUPER_ADMIN', 'Administracion institucional global, auditoria, dispositivos y biometria'),
('coordinador', 'Gestion academica dentro de un area asignada'),
('instructor', 'Gestion de grupos asignados, sesiones, asistencia y observaciones'),
('aprendiz', 'Portal movil, asistencia, justificaciones y consulta propia');

INSERT INTO `usuarios` (`email`, `password`, `id_rol`, `estado`, `debe_cambiar_password`) VALUES
('superadmin@sena.edu.co', '$2b$10$BbEVitY6RmOumhkfGbrKGOe/LJLtS8KLgi72mtsg8XB1345.K..t6', 1, 'ACTIVO', TRUE),
('coordinador@sena.edu.co', '$2b$10$BbEVitY6RmOumhkfGbrKGOe/LJLtS8KLgi72mtsg8XB1345.K..t6', 2, 'ACTIVO', TRUE),
('instructor_franco@sena.edu.co', '$2b$10$8M1zdNStdTSIWMMK6fGw9.TqadN2nE4UASbu.8//sy6Lfe6TXlAYK', 3, 'ACTIVO', FALSE),
('jorge.estudiante@sena.edu.co', '$2b$10$8dktn0gRraHr9nx2Gh6zf.s7brDmKLrOlrr/4H.nn/vQAhvdyNF8i', 4, 'ACTIVO', FALSE);

INSERT INTO `personas` (`id_usuario`, `tipo_documento`, `numero_documento`, `nombres`, `apellidos`, `telefono`) VALUES
(1, 'CC', '1000000000', 'Super', 'Administrador', '3000000000'),
(2, 'CC', '1000000001', 'Coordinador', 'Area', '3001112233'),
(3, 'CC', '1000000002', 'Franco', 'Reina', '3114445566'),
(4, 'CC', '1000000003', 'Jorge', 'Crucerira', '3227778899');

INSERT INTO `areas_formacion` (`nombre_area`) VALUES
('CTPI'),
('AGRO'),
('TELECO');



INSERT INTO `ambientes` (`nombre_ambiente`, `ubicacion`, `capacidad`, `estado`) VALUES
('ADSO#3', 'Piso 2, Ala Sur', 30, 'ACTIVO'),
('AGRO#9', 'Piso 1, Ala Norte', 20, 'ACTIVO'),
('TELECO#1', 'Piso 2, Edificio B', 25, 'MANTENIMIENTO');

INSERT INTO `programas_formacion` (`id_area`, `nombre_programa`) VALUES
(1, 'ADSO');

INSERT INTO `clases_competencias` (`nombre_competencia`, `tipo_competencia`, `estado`) VALUES
('BACKEND', 'FORMATIVA', 'ACTIVA'),
('BASES DE DATOS', 'FORMATIVA', 'ACTIVA'),
('INGLES', 'TRANSVERSAL', 'ACTIVA');

INSERT INTO `programa_clase_competencia` (`id_programa`, `id_clase_competencia`, `estado`) VALUES
(1, 1, 'ACTIVO'),
(1, 2, 'ACTIVO'),
(1, 3, 'ACTIVO');

INSERT INTO `instructores` (`id_usuario`, `codigo_instructor`, `especialidad`, `estado`) VALUES
(3, 'INS-001', 'Desarrollo Fullstack y Arquitectura', 'ACTIVO');

INSERT INTO `aprendices` (`id_usuario`, `estado_formativo`, `estado`) VALUES
(4, 'EN_FORMACION', 'ACTIVO');

INSERT INTO `grupos_formativos` (`numero_ficha`, `id_programa`, `jornada`, `fecha_inicio`, `fecha_fin`, `id_ambiente`, `id_instructor_lider`, `trimestres`) VALUES
('3064975', 1, 'MAÑANA', '2025-01-20', '2026-07-20', 1, 1, 6);

INSERT INTO `grupo_trimestre` (`id_grupo`, `numero_trimestre`, `fecha_inicio`, `fecha_fin`, `estado`) VALUES
(1, 1, '2025-01-20', '2025-04-20', 'COMPLETADO'),
(1, 2, '2025-04-20', '2025-07-20', 'COMPLETADO'),
(1, 3, '2025-07-20', '2025-10-20', 'COMPLETADO'),
(1, 4, '2025-10-20', '2026-01-20', 'COMPLETADO'),
(1, 5, '2026-01-20', '2026-04-20', 'COMPLETADO'),
(1, 6, '2026-04-20', '2026-07-20', 'ACTIVO');

INSERT INTO `instructor_grupo` (`id_instructor`, `id_grupo`, `estado`, `fecha_inicio`, `asignado_por`) VALUES
(1, 1, 'ACTIVO', '2025-01-20 00:00:00', 2);

INSERT INTO `instructor_lider_historial` (`id_grupo`, `id_instructor`, `fecha_inicio`, `asignado_por`, `estado`) VALUES
(1, 1, '2025-01-20 00:00:00', 2, 'ACTIVO');

INSERT INTO `aprendiz_grupo` (`id_aprendiz`, `id_grupo`, `estado`, `fecha_inicio`, `asignado_por`) VALUES
(1, 1, 'ACTIVO', '2025-01-20 00:00:00', 2);

INSERT INTO `bloques_jornada` (`jornada`, `nombre_bloque`, `orden`, `hora_inicio`, `hora_fin`, `estado`) VALUES
('MANAÑA', 'Bloque manaña 1', 1, '07:00:00', '09:30:00', 'ACTIVO'),
('MANAÑA', 'Bloque manaña 2', 2, '10:00:00', '12:30:00', 'ACTIVO'),
('MANAÑA', 'Bloque manaña 3', 3, '07:00:00', '12:30:00', 'ACTIVO'),
('TARDE', 'Bloque tarde 1', 1, '14:00:00', '16:30:00', 'ACTIVO'),
('TARDE', 'Bloque tarde 2', 2, '17:00:00', '19:00:00', 'ACTIVO'),
('TARDE', 'Bloque tarde 3', 3, '14:00:00', '19:00:00', 'ACTIVO'),
('NOCHE', 'Bloque noche 1', 1, '20:00:00', '22:00:00', 'ACTIVO');

INSERT INTO `horarios_formacion` (`id_grupo_trimestre`, `id_clase_competencia`, `id_instructor_grupo`, `id_bloque_jornada`, `id_ambiente`, `dia_semana`, `hora_inicio`, `hora_fin`) VALUES
(6, 1, 1, 1, 1, 1, '07:00:00', '09:30:00'),
(6, 2, 1, 2, 1, 1, '10:00:00', '12:30:00');

INSERT INTO `dispositivos_iot` (`codigo_dispositivo`, `id_ambiente`, `tipo_dispositivo`, `estado`, `ultima_conexion`, `ultima_sincronizacion`, `creado_por`) VALUES
('ESP32-LAB-001', 1, 'ESP32_HUELLA', 'ACTIVO', '2026-06-17 06:50:00', '2026-06-17 06:51:00', 1),
('ESP32-TALLER-002', 2, 'ESP32_HUELLA', 'ACTIVO', NULL, NULL, 1);



INSERT INTO `intentos_asistencia_iot` (`id_dispositivo`, `id_sesion_formacion`, `id_usuario`, `tipo_intento`, `resultado`, `calidad_captura`, `evento_uuid`, `nonce`, `firma_evento`, `fecha_origen`, `expira_en`, `motivo`, `detalle`) VALUES
(1, 1, 4, 'ASISTENCIA', 'EXITOSO', 88, '00000000-0000-4000-8000-000000000001', 'seed-nonce-iot-0001', 'seed-firma-iot-demo-0001', '2026-06-17 07:05:00', '2026-06-17 07:10:00', 'HUELLA_VALIDADA', 'Intento IoT exitoso de ejemplo'),
(1, 1, NULL, 'ASISTENCIA', 'RECHAZADO', 42, '00000000-0000-4000-8000-000000000002', 'seed-nonce-iot-0002', 'seed-firma-iot-demo-0002', '2026-06-17 07:07:00', '2026-06-17 07:12:00', 'HUELLA_NO_IDENTIFICADA', 'Intento fallido conservado sin usuario identificado');

UPDATE `asistencias`
   SET `id_acceso` = 1,
       `estado_asistencia` = 'PRESENTE',
       `hora_registro` = '07:05:00',
       `origen` = 'IOT_HUELLA'
 WHERE `id_asistencia` = 1;

UPDATE `intentos_asistencia_iot`
   SET `id_asistencia` = 1
 WHERE `id_intento_iot` = 1;

INSERT INTO `evidencias_asistencia` (`id_asistencia`, `metodo`, `resultado`, `id_usuario_registra`, `id_dispositivo`, `id_acceso`, `id_intento_iot`, `detalle`) VALUES
(1, 'IOT_HUELLA', 'APROBADA', 4, 1, 1, 1, 'Asistencia validada por lector IoT de huella');

INSERT INTO `observaciones` (`id_aprendiz`, `id_grupo`, `id_instructor`, `tipo_observacion`, `severidad`, `origen`, `descripcion`, `estado`) VALUES
(1, 1, 1, 'ACADEMICA', 'LEVE', 'MANUAL', 'Excelente desempeno en el desarrollo de la logica de base de datos.', 'ABIERTA');

INSERT INTO `alertas` (`id_aprendiz`, `id_grupo`, `tipo_alerta`, `origen`, `severidad`, `descripcion`, `creada_por`) VALUES
(1, 1, 'CONVIVENCIAL', 'MANUAL', 'LEVE', 'Alerta de ejemplo asociada a observacion convivencial o academica.', 3);

INSERT INTO `alerta_observaciones` (`id_alerta`, `id_observacion`, `asociada_por`) VALUES
(1, 1, 3);

INSERT INTO `notificaciones` (`id_usuario`, `id_alerta`, `id_observacion`, `titulo`, `mensaje`, `tipo`) VALUES
(4, 1, 1, 'Nueva observacion', 'Se ha registrado una observacion en tu perfil.', 'OBSERVACION');

INSERT INTO `auditoria_privilegiada` (`id_usuario_responsable`, `accion`, `entidad`, `id_entidad`, `valor_anterior`, `valor_nuevo`, `motivo`, `resultado`) VALUES
(1, 'SEED_INICIAL', 'usuarios', 1, NULL, JSON_OBJECT('rol', 'SUPER_ADMIN', 'estado', 'ACTIVO'), 'Aprovisionamiento inicial controlado', 'EXITOSO'),
(1, 'ENROLAR_HUELLA', 'huellas_biometricas', 1, NULL, JSON_OBJECT('estado', 'ACTIVA'), 'Seed de demostracion de enrolamiento protegido', 'EXITOSO');

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
