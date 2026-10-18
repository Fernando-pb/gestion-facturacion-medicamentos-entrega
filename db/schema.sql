-- Esquema PostgreSQL inicial del MVP de gestion de facturacion de medicamentos.

-- Tablas maestras

CREATE TABLE ayuntamiento (
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    cif TEXT NOT NULL,
    denominacion TEXT NOT NULL,
    direccion TEXT NOT NULL,
    codigo_postal TEXT NOT NULL,
    localidad TEXT NOT NULL,
    provincia TEXT NOT NULL,
    telefono TEXT,
    movil TEXT,
    persona_responsable TEXT,
    persona_contacto TEXT,
    alcalde TEXT,
    estado TEXT NOT NULL,
    tipo_lista_medicamentos TEXT NOT NULL,
    CONSTRAINT pk_ayuntamiento PRIMARY KEY (id),
    CONSTRAINT uq_ayuntamiento_cif UNIQUE (cif),
    CONSTRAINT ck_ayuntamiento_estado
        CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    CONSTRAINT ck_ayuntamiento_tipo_lista_medicamentos
        CHECK (tipo_lista_medicamentos IN ('GENERAL', 'ESPECIFICA'))
);

CREATE TABLE farmacia (
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    soe TEXT NOT NULL,
    cif_nif TEXT NOT NULL,
    denominacion TEXT NOT NULL,
    direccion TEXT NOT NULL,
    codigo_postal TEXT NOT NULL,
    localidad TEXT NOT NULL,
    provincia TEXT NOT NULL,
    telefono TEXT,
    ayuntamiento_id INTEGER,
    pais_control_iban TEXT,
    entidad_bancaria TEXT,
    sucursal_bancaria TEXT,
    digito_control_bancario TEXT,
    cuenta_bancaria TEXT,
    CONSTRAINT pk_farmacia PRIMARY KEY (id),
    CONSTRAINT uq_farmacia_soe UNIQUE (soe),
    CONSTRAINT fk_farmacia_ayuntamiento
        FOREIGN KEY (ayuntamiento_id)
        REFERENCES ayuntamiento (id)
        ON DELETE RESTRICT
        ON UPDATE NO ACTION
);

CREATE TABLE medicamento (
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    codigo_nacional TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    precio NUMERIC(12,2) NOT NULL,
    estado TEXT NOT NULL,
    situacion_comercial TEXT NOT NULL,
    tipo_facturacion TEXT NOT NULL,
    grupo_terapeutico TEXT,
    codigo_laboratorio TEXT,
    gtatc TEXT,
    nombre_grupo TEXT,
    anexo TEXT,
    CONSTRAINT pk_medicamento PRIMARY KEY (id),
    CONSTRAINT uq_medicamento_codigo_nacional UNIQUE (codigo_nacional),
    CONSTRAINT ck_medicamento_precio CHECK (precio >= 0),
    CONSTRAINT ck_medicamento_estado
        CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    CONSTRAINT ck_medicamento_situacion_comercial
        CHECK (situacion_comercial IN ('ALTA', 'BAJA')),
    CONSTRAINT ck_medicamento_tipo_facturacion
        CHECK (tipo_facturacion = 'TD')
);

CREATE TABLE periodo (
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    mes SMALLINT NOT NULL,
    anio INTEGER NOT NULL,
    CONSTRAINT pk_periodo PRIMARY KEY (id),
    CONSTRAINT uq_periodo_mes_anio UNIQUE (mes, anio),
    CONSTRAINT ck_periodo_mes CHECK (mes BETWEEN 1 AND 12)
);

CREATE TABLE configuracion_facturacion (
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    porcentaje_comision NUMERIC(7,4) NOT NULL,
    porcentaje_iva NUMERIC(7,4) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    CONSTRAINT pk_configuracion_facturacion PRIMARY KEY (id),
    CONSTRAINT ck_configuracion_facturacion_porcentaje_comision
        CHECK (porcentaje_comision BETWEEN 0 AND 100),
    CONSTRAINT ck_configuracion_facturacion_porcentaje_iva
        CHECK (porcentaje_iva BETWEEN 0 AND 100),
    CONSTRAINT ck_configuracion_facturacion_fechas
        CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE TABLE configuracion_documentos (
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    logo_personalizado TEXT,
    nombre_presidente TEXT,
    firma TEXT,
    mostrar_firma BOOLEAN NOT NULL DEFAULT FALSE,
    datos_emisor JSONB,
    CONSTRAINT pk_configuracion_documentos PRIMARY KEY (id),
    CONSTRAINT ck_configuracion_documentos_firma
        CHECK (NOT mostrar_firma OR firma IS NOT NULL)
);

CREATE UNIQUE INDEX uq_configuracion_documentos_unica ON configuracion_documentos ((true));

-- Tablas de relacion y operacion

CREATE TABLE ayuntamiento_medicamento (
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    ayuntamiento_id INTEGER NOT NULL,
    medicamento_id INTEGER NOT NULL,
    CONSTRAINT pk_ayuntamiento_medicamento PRIMARY KEY (id),
    CONSTRAINT uq_ayuntamiento_medicamento
        UNIQUE (ayuntamiento_id, medicamento_id),
    CONSTRAINT fk_ayuntamiento_medicamento_ayuntamiento
        FOREIGN KEY (ayuntamiento_id)
        REFERENCES ayuntamiento (id)
        ON DELETE RESTRICT
        ON UPDATE NO ACTION,
    CONSTRAINT fk_ayuntamiento_medicamento_medicamento
        FOREIGN KEY (medicamento_id)
        REFERENCES medicamento (id)
        ON DELETE RESTRICT
        ON UPDATE NO ACTION
);

CREATE TABLE entrega_farmacia_periodo (
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    farmacia_id INTEGER NOT NULL,
    periodo_id INTEGER NOT NULL,
    denominacion_farmacia TEXT NOT NULL,
    cif_nif_farmacia TEXT NOT NULL,
    precintos_informados INTEGER,
    importe_informado NUMERIC(12,2),
    CONSTRAINT pk_entrega_farmacia_periodo PRIMARY KEY (id),
    CONSTRAINT uq_entrega_farmacia_periodo
        UNIQUE (farmacia_id, periodo_id),
    CONSTRAINT ck_entrega_precintos_informados
        CHECK (precintos_informados >= 0),
    CONSTRAINT ck_entrega_importe_informado
        CHECK (importe_informado >= 0),
    CONSTRAINT fk_entrega_farmacia
        FOREIGN KEY (farmacia_id)
        REFERENCES farmacia (id)
        ON DELETE RESTRICT
        ON UPDATE NO ACTION,
    CONSTRAINT fk_entrega_periodo
        FOREIGN KEY (periodo_id)
        REFERENCES periodo (id)
        ON DELETE RESTRICT
        ON UPDATE NO ACTION
);

CREATE TABLE precinto (
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    entrega_id INTEGER NOT NULL,
    numero_paquete INTEGER NOT NULL,
    posicion_paquete SMALLINT NOT NULL,
    codigo_barras_original TEXT NOT NULL,
    codigo_nacional TEXT NOT NULL,
    medicamento_id INTEGER NOT NULL,
    precio_aplicado NUMERIC(12,2) NOT NULL,
    precio_referencia NUMERIC(12,2) NOT NULL,
    CONSTRAINT pk_precinto PRIMARY KEY (id),
    CONSTRAINT uq_precinto_id_entrega UNIQUE (id, entrega_id),
    CONSTRAINT uq_precinto_posicion
        UNIQUE (entrega_id, numero_paquete, posicion_paquete),
    CONSTRAINT ck_precinto_numero_paquete CHECK (numero_paquete >= 1),
    CONSTRAINT ck_precinto_posicion_paquete
        CHECK (posicion_paquete BETWEEN 1 AND 15),
    CONSTRAINT ck_precinto_precio_aplicado CHECK (precio_aplicado >= 0),
    CONSTRAINT ck_precinto_precio_referencia CHECK (precio_referencia >= 0),
    CONSTRAINT fk_precinto_entrega
        FOREIGN KEY (entrega_id)
        REFERENCES entrega_farmacia_periodo (id)
        ON DELETE RESTRICT
        ON UPDATE NO ACTION,
    CONSTRAINT fk_precinto_medicamento
        FOREIGN KEY (medicamento_id)
        REFERENCES medicamento (id)
        ON DELETE RESTRICT
        ON UPDATE NO ACTION
);

CREATE TABLE incidencia (
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    entrega_id INTEGER NOT NULL,
    codigo_barras_original TEXT NOT NULL,
    codigo_nacional TEXT,
    motivo TEXT NOT NULL,
    observaciones TEXT,
    CONSTRAINT pk_incidencia PRIMARY KEY (id),
    CONSTRAINT uq_incidencia_id_entrega UNIQUE (id, entrega_id),
    CONSTRAINT ck_incidencia_motivo
        CHECK (motivo IN (
            'MEDICAMENTO_DESCONOCIDO',
            'MEDICAMENTO_NO_AUTORIZADO',
            'MEDICAMENTO_INACTIVO',
            'BAJA_COMERCIAL_RECHAZADA_USUARIO'
        )),
    CONSTRAINT fk_incidencia_entrega
        FOREIGN KEY (entrega_id)
        REFERENCES entrega_farmacia_periodo (id)
        ON DELETE RESTRICT
        ON UPDATE NO ACTION
);

-- Recibo técnico activo o clave retirada sin contenido; no es historial de lecturas borradas.
CREATE TABLE operacion_lectura (
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    entrega_id INTEGER NOT NULL,
    clave UUID NOT NULL,
    solicitud JSONB,
    retirada BOOLEAN NOT NULL DEFAULT FALSE,
    precinto_id INTEGER,
    incidencia_id INTEGER,
    CONSTRAINT pk_operacion_lectura PRIMARY KEY (id),
    CONSTRAINT uq_operacion_lectura_clave UNIQUE (entrega_id, clave),
    CONSTRAINT uq_operacion_lectura_precinto UNIQUE (precinto_id),
    CONSTRAINT uq_operacion_lectura_incidencia UNIQUE (incidencia_id),
    CONSTRAINT ck_operacion_lectura_destino CHECK (
        (retirada AND precinto_id IS NULL AND incidencia_id IS NULL AND solicitud IS NULL)
        OR (NOT retirada AND num_nonnulls(precinto_id, incidencia_id) = 1 AND solicitud IS NOT NULL)
    ),
    CONSTRAINT ck_operacion_lectura_solicitud CHECK (solicitud IS NULL OR jsonb_typeof(solicitud) = 'object'),
    CONSTRAINT fk_operacion_lectura_entrega FOREIGN KEY (entrega_id)
        REFERENCES entrega_farmacia_periodo (id) ON DELETE RESTRICT,
    CONSTRAINT fk_operacion_lectura_precinto FOREIGN KEY (precinto_id, entrega_id)
        REFERENCES precinto (id, entrega_id) ON DELETE CASCADE,
    CONSTRAINT fk_operacion_lectura_incidencia FOREIGN KEY (incidencia_id, entrega_id)
        REFERENCES incidencia (id, entrega_id) ON DELETE CASCADE
);

CREATE TABLE facturacion (
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    ayuntamiento_id INTEGER NOT NULL,
    periodo_id INTEGER NOT NULL,
    tipo_facturacion TEXT NOT NULL,
    fecha_factura DATE NOT NULL,
    estado TEXT NOT NULL DEFAULT 'REVISION',
    nombre_presidente_historico TEXT,
    CONSTRAINT pk_facturacion PRIMARY KEY (id),
    CONSTRAINT uq_facturacion_ayuntamiento_periodo_tipo
        UNIQUE (ayuntamiento_id, periodo_id, tipo_facturacion),
    CONSTRAINT ck_facturacion_tipo CHECK (tipo_facturacion = 'TD'),
    CONSTRAINT ck_facturacion_estado CHECK (estado IN ('REVISION', 'EMITIDA', 'REABIERTA')),
    CONSTRAINT fk_facturacion_ayuntamiento
        FOREIGN KEY (ayuntamiento_id)
        REFERENCES ayuntamiento (id)
        ON DELETE RESTRICT
        ON UPDATE NO ACTION,
    CONSTRAINT fk_facturacion_periodo
        FOREIGN KEY (periodo_id)
        REFERENCES periodo (id)
        ON DELETE RESTRICT
        ON UPDATE NO ACTION
);

-- Tablas financieras

CREATE TABLE participacion_facturacion (
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    facturacion_id INTEGER NOT NULL,
    entrega_id INTEGER NOT NULL,
    soe_b TEXT NOT NULL,
    denominacion_b TEXT NOT NULL,
    cif_b TEXT NOT NULL,
    importe_precintos NUMERIC(12,2) NOT NULL,
    CONSTRAINT pk_participacion_facturacion PRIMARY KEY (id),
    CONSTRAINT uq_participacion_facturacion_entrega UNIQUE (entrega_id),
    CONSTRAINT ck_participacion_facturacion_importe
        CHECK (importe_precintos >= 0),
    CONSTRAINT fk_participacion_facturacion_facturacion
        FOREIGN KEY (facturacion_id)
        REFERENCES facturacion (id)
        ON DELETE RESTRICT
        ON UPDATE NO ACTION,
    CONSTRAINT fk_participacion_facturacion_entrega
        FOREIGN KEY (entrega_id)
        REFERENCES entrega_farmacia_periodo (id)
        ON DELETE RESTRICT
        ON UPDATE NO ACTION
);

CREATE TABLE factura (
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    facturacion_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    numero_factura TEXT NOT NULL,
    numero_precintos INTEGER,
    importe_total NUMERIC(12,2) NOT NULL,
    base_calculo NUMERIC(12,2),
    porcentaje_comision NUMERIC(7,4),
    importe_comision NUMERIC(12,2),
    porcentaje_iva NUMERIC(7,4),
    importe_iva NUMERIC(12,2),
    configuracion_facturacion_id INTEGER,
    CONSTRAINT pk_factura PRIMARY KEY (id),
    CONSTRAINT uq_factura_facturacion_tipo UNIQUE (facturacion_id, tipo),
    CONSTRAINT uq_factura_tipo_numero_factura UNIQUE (tipo, numero_factura),
    CONSTRAINT ck_factura_tipo
        CHECK (tipo IN ('PRECINTOS', 'COMISION')),
    CONSTRAINT ck_factura_importe_total CHECK (importe_total >= 0),
    CONSTRAINT ck_factura_numero_precintos
        CHECK (numero_precintos IS NULL OR numero_precintos >= 0),
    CONSTRAINT ck_factura_base_calculo
        CHECK (base_calculo IS NULL OR base_calculo >= 0),
    CONSTRAINT ck_factura_porcentaje_comision
        CHECK (
            porcentaje_comision IS NULL
            OR porcentaje_comision BETWEEN 0 AND 100
        ),
    CONSTRAINT ck_factura_importe_comision
        CHECK (importe_comision IS NULL OR importe_comision >= 0),
    CONSTRAINT ck_factura_porcentaje_iva
        CHECK (
            porcentaje_iva IS NULL
            OR porcentaje_iva BETWEEN 0 AND 100
        ),
    CONSTRAINT ck_factura_importe_iva
        CHECK (importe_iva IS NULL OR importe_iva >= 0),
    CONSTRAINT ck_factura_campos_por_tipo
        CHECK (
            (
                tipo = 'PRECINTOS'
                AND numero_precintos IS NOT NULL
                AND base_calculo IS NULL
                AND porcentaje_comision IS NULL
                AND importe_comision IS NULL
                AND porcentaje_iva IS NULL
                AND importe_iva IS NULL
                AND configuracion_facturacion_id IS NULL
            )
            OR
            (
                tipo = 'COMISION'
                AND numero_precintos IS NULL
                AND base_calculo IS NOT NULL
                AND porcentaje_comision IS NOT NULL
                AND importe_comision IS NOT NULL
                AND porcentaje_iva IS NOT NULL
                AND importe_iva IS NOT NULL
                AND configuracion_facturacion_id IS NOT NULL
            )
        ),
    CONSTRAINT fk_factura_facturacion
        FOREIGN KEY (facturacion_id)
        REFERENCES facturacion (id)
        ON DELETE RESTRICT
        ON UPDATE NO ACTION,
    CONSTRAINT fk_factura_configuracion_facturacion
        FOREIGN KEY (configuracion_facturacion_id)
        REFERENCES configuracion_facturacion (id)
        ON DELETE RESTRICT
        ON UPDATE NO ACTION
);

CREATE TABLE cobro (
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    factura_id INTEGER NOT NULL,
    fecha_cobro DATE NOT NULL,
    importe_cobrado NUMERIC(12,2) NOT NULL,
    justificante TEXT,
    CONSTRAINT pk_cobro PRIMARY KEY (id),
    CONSTRAINT uq_cobro_factura UNIQUE (factura_id),
    CONSTRAINT ck_cobro_importe_cobrado CHECK (importe_cobrado >= 0),
    CONSTRAINT fk_cobro_factura
        FOREIGN KEY (factura_id)
        REFERENCES factura (id)
        ON DELETE RESTRICT
        ON UPDATE NO ACTION
);

CREATE TABLE reapertura_facturacion (
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    facturacion_id INTEGER NOT NULL,
    fecha_reapertura TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    motivo TEXT NOT NULL,
    CONSTRAINT pk_reapertura_facturacion PRIMARY KEY (id),
    CONSTRAINT fk_reapertura_facturacion
        FOREIGN KEY (facturacion_id)
        REFERENCES facturacion (id)
        ON DELETE RESTRICT
        ON UPDATE NO ACTION
);

CREATE TABLE pago_farmacias (
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    facturacion_id INTEGER NOT NULL,
    fecha_pago DATE NOT NULL,
    CONSTRAINT pk_pago_farmacias PRIMARY KEY (id),
    CONSTRAINT uq_pago_farmacias_facturacion UNIQUE (facturacion_id),
    CONSTRAINT fk_pago_farmacias_facturacion
        FOREIGN KEY (facturacion_id)
        REFERENCES facturacion (id)
        ON DELETE RESTRICT
        ON UPDATE NO ACTION
);

CREATE TABLE detalle_pago_farmacia (
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    pago_farmacias_id INTEGER NOT NULL,
    participacion_facturacion_id INTEGER NOT NULL,
    soe TEXT NOT NULL,
    denominacion_farmacia TEXT NOT NULL,
    cif_nif TEXT NOT NULL,
    importe NUMERIC(12,2) NOT NULL,
    pais_control_iban TEXT NOT NULL,
    entidad_bancaria TEXT NOT NULL,
    sucursal_bancaria TEXT NOT NULL,
    digito_control_bancario TEXT NOT NULL,
    cuenta_bancaria TEXT NOT NULL,
    CONSTRAINT pk_detalle_pago_farmacia PRIMARY KEY (id),
    CONSTRAINT uq_detalle_pago_farmacia_participacion
        UNIQUE (participacion_facturacion_id),
    CONSTRAINT ck_detalle_pago_farmacia_importe CHECK (importe >= 0),
    CONSTRAINT fk_detalle_pago_farmacia_pago
        FOREIGN KEY (pago_farmacias_id)
        REFERENCES pago_farmacias (id)
        ON DELETE RESTRICT
        ON UPDATE NO ACTION,
    CONSTRAINT fk_detalle_pago_farmacia_participacion
        FOREIGN KEY (participacion_facturacion_id)
        REFERENCES participacion_facturacion (id)
        ON DELETE RESTRICT
        ON UPDATE NO ACTION
);

-- Indices adicionales para claves foraneas no cubiertas por PK o UNIQUE

CREATE INDEX ix_farmacia_ayuntamiento_id
    ON farmacia (ayuntamiento_id);

CREATE INDEX ix_ayuntamiento_medicamento_medicamento_id
    ON ayuntamiento_medicamento (medicamento_id);

CREATE INDEX ix_entrega_farmacia_periodo_periodo_id
    ON entrega_farmacia_periodo (periodo_id);

CREATE INDEX ix_precinto_medicamento_id
    ON precinto (medicamento_id);

CREATE INDEX ix_incidencia_entrega_id
    ON incidencia (entrega_id);

CREATE INDEX ix_facturacion_periodo_id
    ON facturacion (periodo_id);

CREATE INDEX ix_participacion_facturacion_facturacion_id
    ON participacion_facturacion (facturacion_id);

CREATE INDEX ix_factura_configuracion_facturacion_id
    ON factura (configuracion_facturacion_id);

CREATE INDEX ix_reapertura_facturacion_facturacion_id
    ON reapertura_facturacion (facturacion_id);
