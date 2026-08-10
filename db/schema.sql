-- =============================================================================
-- ESQUEMA COMPLETO DE BASE DE DATOS RELACIONAL (MySQL / PostgreSQL)
-- Plataforma PWA de Ventas Casa por Casa, Cobranza, Cortes e Impresión de Tarjetas
-- =============================================================================

-- 1. TABLA DE USUARIOS Y ROLES
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('vendedora', 'sup_vendedores', 'cobrador', 'sup_cobradores', 'admin') NOT NULL,
    telefono VARCHAR(20),
    activo TINYINT(1) DEFAULT 1,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA DE ZONAS Y CUADRANTES DE COBRO
CREATE TABLE IF NOT EXISTS zonas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    dia_cobro ENUM('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo') NOT NULL,
    cuadrante VARCHAR(50) NOT NULL,
    descripcion TEXT
);

-- 3. TABLA DE CLIENTES (CON GEOLOCALIZACIÓN Y CONTROL DE FOTOS / TARJETA)
CREATE TABLE IF NOT EXISTS clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    folio VARCHAR(30) UNIQUE NOT NULL,
    nombre_completo VARCHAR(150) NOT NULL,
    direccion TEXT NOT NULL,
    referencias TEXT,
    telefono VARCHAR(20),
    latitud DECIMAL(10, 8) NOT NULL,
    longitud DECIMAL(11, 8) NOT NULL,
    latitud_secundaria DECIMAL(10, 8),
    longitud_secundaria DECIMAL(11, 8),
    zona_id INT NOT NULL,
    foto_fachada LONGTEXT,
    foto_cliente LONGTEXT,
    foto_contrato LONGTEXT,
    tarjeta_impresa TINYINT(1) DEFAULT 0,
    estado_morosidad ENUM('VERDE', 'AMARILLO', 'ROJO') DEFAULT 'VERDE',
    creado_por_vendedora_id INT NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (zona_id) REFERENCES zonas(id),
    FOREIGN KEY (creado_por_vendedora_id) REFERENCES usuarios(id)
);

-- 4. TABLA DE VENTAS (CÁLCULO Y APORTES FINANCIEROS HARDCODED)
CREATE TABLE IF NOT EXISTS ventas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    vendedora_id INT NOT NULL,
    supervisor_id INT,
    tipo ENUM('CREDITO', 'CONTADO') NOT NULL DEFAULT 'CREDITO',
    precio_base DECIMAL(10,2) NOT NULL DEFAULT 1490.00,
    enganche_monto DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    aporte_empresa DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    descuento_otorgado DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    saldo_inicial DECIMAL(10,2) NOT NULL,
    saldo_actual DECIMAL(10,2) NOT NULL,
    pago_semanal DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    comision_vendedora DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    estado ENUM('PENDIENTE_VALIDACION', 'APROBADA', 'RECHAZADA') DEFAULT 'PENDIENTE_VALIDACION',
    fecha_venta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_primer_pago DATE NOT NULL,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (vendedora_id) REFERENCES usuarios(id),
    FOREIGN KEY (supervisor_id) REFERENCES usuarios(id)
);

-- 5. TABLA DE ABONOS Y COBRANZA
CREATE TABLE IF NOT EXISTS abonos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    venta_id INT NOT NULL,
    cliente_id INT NOT NULL,
    cobrador_id INT NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    tipo_pago ENUM('EFECTIVO', 'TRANSFERENCIA', 'MIXTO') DEFAULT 'EFECTIVO',
    semana_numero INT NOT NULL,
    observaciones TEXT,
    fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    latitud_cobro DECIMAL(10, 8),
    longitud_cobro DECIMAL(11, 8),
    wa_enviado TINYINT(1) DEFAULT 0,
    FOREIGN KEY (venta_id) REFERENCES ventas(id),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (cobrador_id) REFERENCES usuarios(id)
);

-- 6. TABLA DE CORTES DE CAJA (VIÁTICOS, GASOLINA Y CAMBIO)
CREATE TABLE IF NOT EXISTS cortes_caja (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    rol_tipo ENUM('VENDEDORA', 'SUPERVISOR_VEND', 'COBRADOR', 'SUPERVISOR_COBR') NOT NULL,
    fecha DATE NOT NULL,
    fondo_inicial DECIMAL(10,2) DEFAULT 0.00,
    gastos_gasolina DECIMAL(10,2) DEFAULT 0.00,
    viaticos DECIMAL(10,2) DEFAULT 0.00,
    efectivo_recolectado DECIMAL(10,2) DEFAULT 0.00,
    efectivo_entregado DECIMAL(10,2) DEFAULT 0.00,
    diferencia DECIMAL(10,2) DEFAULT 0.00,
    estado ENUM('ABIERTO', 'CERRADO', 'AUDITADO') DEFAULT 'ABIERTO',
    observaciones TEXT,
    fecha_cierre TIMESTAMP NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- 7. TABLA DE COMISIONES Y NÓMINA HÍBRIDA
CREATE TABLE IF NOT EXISTS comisiones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    semana_ano VARCHAR(10) NOT NULL, -- Ej: '2026-W30'
    ventas_count INT DEFAULT 0,
    total_cobrado DECIMAL(10,2) DEFAULT 0.00,
    monto_comision DECIMAL(10,2) DEFAULT 0.00,
    monto_sueldo_base DECIMAL(10,2) DEFAULT 0.00,
    total_a_pagar DECIMAL(10,2) DEFAULT 0.00,
    cumplio_meta TINYINT(1) DEFAULT 0, -- Meta 20 ventas para sueldo base
    estado ENUM('PENDIENTE', 'PAGADO') DEFAULT 'PENDIENTE',
    fecha_pago TIMESTAMP NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- INSERCIÓN DE DATOS INICIALES DE DEMOSTRACIÓN
INSERT INTO usuarios (nombre, email, password_hash, rol, telefono) VALUES
('Ana Lucía Gómez', 'vendedora@empresa.com', 'hash123', 'vendedora', '5512345678'),
('Patricia Silva', 'sup_v@empresa.com', 'hash123', 'sup_vendedores', '5523456789'),
('Carlos López', 'cobrador@empresa.com', 'hash123', 'cobrador', '5534567890'),
('Roberto Mendoza', 'sup_c@empresa.com', 'hash123', 'sup_cobradores', '5545678901'),
('Administrador General', 'admin@empresa.com', 'hash123', 'admin', '5556789012');

INSERT INTO zonas (nombre, dia_cobro, cuadrante, descripcion) VALUES
('Zona Zapata', 'Lunes', 'Cuadrante Norte', 'Colonias Zapata, San Miguel y alrededores'),
('Zona San Antonio', 'Martes', 'Cuadrante Oriente', 'Zona comercial San Antonio y Ejidos'),
('Zona Nueva San Miguel', 'Miércoles', 'Cuadrante Sur', 'Sector poniente y áreas residenciales'),
('Zona Centro-Sur', 'Jueves', 'Cuadrante Poniente', 'Sector central y mercado municipal'),
('Zona San Juan', 'Viernes', 'Cuadrante Ejidal', 'Comunidades rurales y zona poniente');
