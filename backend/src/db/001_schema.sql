-- Tunnel DT System - Database Schema
-- PostgreSQL 16 + PostGIS 3.4
-- TimescaleDB is optional (install separately for time-series features)

SET client_encoding = 'UTF8';

-- Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. Projects
-- ============================================================
CREATE TABLE projects (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(200) NOT NULL,
    code        VARCHAR(50)  NOT NULL UNIQUE,
    description TEXT,
    status      VARCHAR(30)  NOT NULL DEFAULT 'planning',
    region      VARCHAR(100),
    start_date  DATE,
    expected_end_date DATE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. Tunnels
-- ============================================================
CREATE TABLE tunnels (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    code            VARCHAR(50)  NOT NULL,
    type            VARCHAR(30)  NOT NULL DEFAULT 'main',
    construction_method VARCHAR(30) NOT NULL DEFAULT 'drill_blast',
    centerline      GEOMETRY(LINESTRINGZ, 4326) NOT NULL,
    start_mileage   DECIMAL(10,3) NOT NULL,
    end_mileage     DECIMAL(10,3) NOT NULL,
    length_m        DECIMAL(10,2),
    cross_section_area_m2 DECIMAL(8,2),
    status          VARCHAR(30) NOT NULL DEFAULT 'excavating',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, code)
);
CREATE INDEX idx_tunnels_centerline ON tunnels USING GIST(centerline);
CREATE INDEX idx_tunnels_project ON tunnels(project_id);

-- ============================================================
-- 3. Mileage Reference Points
-- ============================================================
CREATE TABLE mileage_reference_points (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tunnel_id   UUID NOT NULL REFERENCES tunnels(id) ON DELETE CASCADE,
    dk_number   DECIMAL(10,3) NOT NULL,
    label       VARCHAR(30),
    location    GEOMETRY(POINTZ, 4326) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tunnel_id, dk_number)
);
CREATE INDEX idx_mileage_points_location ON mileage_reference_points USING GIST(location);

-- ============================================================
-- 4. Worksites (tunnel faces)
-- ============================================================
CREATE TABLE worksites (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tunnel_id       UUID NOT NULL REFERENCES tunnels(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    code            VARCHAR(50)  NOT NULL,
    dk_number       DECIMAL(10,3) NOT NULL,
    location        GEOMETRY(POINTZ, 4326) NOT NULL,
    rock_classification VARCHAR(5) NOT NULL DEFAULT 'IV',
    cross_section_area_m2 DECIMAL(8,2),
    excavation_method VARCHAR(50) NOT NULL DEFAULT 'drill_blast',
    excavation_step  VARCHAR(30),
    rock_hardness_coeff DECIMAL(5,2),
    risk_level      VARCHAR(20) NOT NULL DEFAULT 'medium',
    current_procedure VARCHAR(50),
    cycle_advance_m DECIMAL(5,2),
    status          VARCHAR(30) NOT NULL DEFAULT 'active',
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tunnel_id, code)
);
CREATE INDEX idx_worksites_tunnel ON worksites(tunnel_id);
CREATE INDEX idx_worksites_location ON worksites USING GIST(location);
CREATE INDEX idx_worksites_dk ON worksites(tunnel_id, dk_number);

-- ============================================================
-- 5. Geological Model Types
-- ============================================================
CREATE TABLE geological_model_types (
    code          VARCHAR(40) PRIMARY KEY,
    name_cn       VARCHAR(100) NOT NULL,
    name_en       VARCHAR(100),
    data_type     VARCHAR(20) NOT NULL,
    render_method VARCHAR(20) NOT NULL,
    category      VARCHAR(30) NOT NULL,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. Geological Model Instances
-- ============================================================
CREATE TABLE geological_model_instances (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tunnel_id       UUID NOT NULL REFERENCES tunnels(id) ON DELETE CASCADE,
    model_type_code VARCHAR(40) NOT NULL REFERENCES geological_model_types(code),
    name            VARCHAR(300) NOT NULL,
    start_dk        DECIMAL(10,3) NOT NULL,
    end_dk          DECIMAL(10,3) NOT NULL,
    glb_urls        JSONB,
    volume_url      VARCHAR(500),
    raw_data_url    VARCHAR(500),
    anchor_lon      DOUBLE PRECISION,
    anchor_lat      DOUBLE PRECISION,
    anchor_height   DOUBLE PRECISION,
    rotation_x      DOUBLE PRECISION DEFAULT 0,
    rotation_y      DOUBLE PRECISION DEFAULT 0,
    rotation_z      DOUBLE PRECISION DEFAULT 0,
    translate_x     DOUBLE PRECISION DEFAULT 0,
    translate_y     DOUBLE PRECISION DEFAULT 0,
    translate_z     DOUBLE PRECISION DEFAULT 0,
    scale_x         DOUBLE PRECISION DEFAULT 1,
    scale_y         DOUBLE PRECISION DEFAULT 1,
    scale_z         DOUBLE PRECISION DEFAULT 1,
    heading_deg     DOUBLE PRECISION,
    glb_heading     DOUBLE PRECISION,
    glb_y_rot       DOUBLE PRECISION,
    glb_z_rot       DOUBLE PRECISION,
    fly_dest_x      DOUBLE PRECISION,
    fly_dest_y      DOUBLE PRECISION,
    fly_dest_z      DOUBLE PRECISION,
    fly_heading     DOUBLE PRECISION,
    fly_pitch       DOUBLE PRECISION,
    look_at_lon     DOUBLE PRECISION,
    look_at_lat     DOUBLE PRECISION,
    look_at_height  DOUBLE PRECISION,
    look_at_offset_x DOUBLE PRECISION DEFAULT 0,
    look_at_offset_y DOUBLE PRECISION DEFAULT 0,
    look_at_offset_z DOUBLE PRECISION DEFAULT 0,
    skip_look_at    BOOLEAN NOT NULL DEFAULT FALSE,
    sub_type        VARCHAR(30),
    reference_mileage DECIMAL(10,3),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    version         INTEGER NOT NULL DEFAULT 1,
    source          VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_geo_mileage CHECK (start_dk <= end_dk)
);
CREATE INDEX idx_geo_models_tunnel ON geological_model_instances(tunnel_id);
CREATE INDEX idx_geo_models_type ON geological_model_instances(model_type_code);
CREATE INDEX idx_geo_models_dk ON geological_model_instances(tunnel_id, start_dk, end_dk);

-- ============================================================
-- 7. Monitoring Configs
-- ============================================================
CREATE TABLE monitoring_configs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worksite_id     UUID NOT NULL REFERENCES worksites(id) ON DELETE CASCADE,
    scene_key       VARCHAR(50),
    metric_key      VARCHAR(50) NOT NULL,
    metric_name_cn  VARCHAR(100) NOT NULL,
    unit            VARCHAR(30),
    normal_min      DOUBLE PRECISION,
    normal_max      DOUBLE PRECISION,
    warning_min     DOUBLE PRECISION,
    warning_max     DOUBLE PRECISION,
    critical_min    DOUBLE PRECISION,
    critical_max    DOUBLE PRECISION,
    collection_interval_sec INTEGER NOT NULL DEFAULT 60,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(worksite_id, scene_key, metric_key)
);

-- ============================================================
-- 8. Monitoring Readings (time-series data)
-- Use regular table + index; upgrade to TimescaleDB hypertable later if needed
-- ============================================================
CREATE TABLE monitoring_readings (
    time      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    config_id UUID NOT NULL REFERENCES monitoring_configs(id) ON DELETE CASCADE,
    value     DOUBLE PRECISION NOT NULL,
    quality   SMALLINT NOT NULL DEFAULT 0,
    metadata  JSONB
);
CREATE INDEX idx_readings_config_time ON monitoring_readings(config_id, time DESC);

-- Hourly aggregate (materialized view, refresh manually or via cron)
CREATE MATERIALIZED VIEW monitoring_hourly_agg AS
SELECT
    date_trunc('hour', time) AS bucket,
    config_id,
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    COUNT(*) AS sample_count
FROM monitoring_readings
GROUP BY date_trunc('hour', time), config_id;

CREATE INDEX idx_hourly_agg_config ON monitoring_hourly_agg(config_id, bucket);

-- ============================================================
-- 9. Personnel
-- ============================================================
CREATE TABLE persons (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          VARCHAR(100) NOT NULL,
    employee_code VARCHAR(50) UNIQUE,
    role          VARCHAR(50) NOT NULL,
    craft         VARCHAR(50),
    phone         VARCHAR(20),
    certification JSONB,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE person_locations (
    id          BIGSERIAL PRIMARY KEY,
    time        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    person_id   UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    tunnel_id   UUID REFERENCES tunnels(id),
    dk_number   DECIMAL(10,3),
    location    GEOMETRY(POINTZ, 4326),
    status      VARCHAR(30) NOT NULL,
    current_task VARCHAR(200),
    source      VARCHAR(30) DEFAULT 'manual'
);
CREATE INDEX idx_person_loc_time ON person_locations(person_id, time DESC);

CREATE VIEW person_current_status AS
SELECT DISTINCT ON (person_id)
    person_id, dk_number, location, status, current_task, time AS last_update
FROM person_locations
ORDER BY person_id, time DESC;

-- ============================================================
-- 10. Equipment
-- ============================================================
CREATE TABLE equipment_types (
    code      VARCHAR(50) PRIMARY KEY,
    name_cn   VARCHAR(100) NOT NULL,
    category  VARCHAR(50)
);

CREATE TABLE equipment (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_type VARCHAR(50) NOT NULL REFERENCES equipment_types(code),
    name           VARCHAR(200) NOT NULL,
    equipment_code VARCHAR(50) UNIQUE,
    specs          JSONB,
    status         VARCHAR(30) NOT NULL DEFAULT 'idle',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE equipment_locations (
    id          BIGSERIAL PRIMARY KEY,
    time        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    tunnel_id   UUID REFERENCES tunnels(id),
    dk_number   DECIMAL(10,3),
    location    GEOMETRY(POINTZ, 4326),
    status      VARCHAR(30) NOT NULL,
    current_task VARCHAR(200),
    operational_params JSONB,
    source      VARCHAR(30) DEFAULT 'manual'
);
CREATE INDEX idx_equip_loc_time ON equipment_locations(equipment_id, time DESC);

CREATE VIEW equipment_current_status AS
SELECT DISTINCT ON (equipment_id)
    equipment_id, dk_number, location, status, current_task, operational_params, time AS last_update
FROM equipment_locations
ORDER BY equipment_id, time DESC;

-- ============================================================
-- 11. Blast Designs
-- ============================================================
CREATE TABLE blast_designs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worksite_id     UUID NOT NULL REFERENCES worksites(id) ON DELETE CASCADE,
    tunnel_id       UUID NOT NULL REFERENCES tunnels(id),
    dk_number       DECIMAL(10,3) NOT NULL,
    name            VARCHAR(200),
    excavation_step VARCHAR(30) NOT NULL,
    hole_depth_m    DECIMAL(5,2) NOT NULL,
    hole_diameter_mm DECIMAL(5,1) DEFAULT 42,
    perimeter_holes INT,
    inner_holes     INT,
    cut_holes       INT,
    total_holes     INT,
    charge_weight_kg DECIMAL(8,2),
    specific_charge_kgm3 DECIMAL(6,2),
    detonation_sequence JSONB,
    overbreak_threshold_m DECIMAL(4,2),
    risk_eval_score  DECIMAL(4,2),
    risk_eval_result TEXT,
    hole_diagram_url VARCHAR(500),
    hole_positions_json JSONB,
    status          VARCHAR(30) NOT NULL DEFAULT 'draft',
    designed_by     VARCHAR(100),
    approved_by     VARCHAR(100),
    executed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_blast_worksite ON blast_designs(worksite_id);
CREATE INDEX idx_blast_tunnel_dk ON blast_designs(tunnel_id, dk_number);

-- ============================================================
-- 12. Support Components
-- ============================================================
CREATE TABLE support_components (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tunnel_id       UUID NOT NULL REFERENCES tunnels(id) ON DELETE CASCADE,
    component_type  VARCHAR(50) NOT NULL,
    material_spec   VARCHAR(200),
    dimensions      JSONB,
    quantity        INTEGER,
    install_date    DATE,
    install_crew    VARCHAR(100),
    design_value    DOUBLE PRECISION,
    measured_mean   DOUBLE PRECISION,
    measured_min    DOUBLE PRECISION,
    quality_grade   VARCHAR(20),
    inspection_date DATE,
    inspection_report_url VARCHAR(500),
    glb_model_url   VARCHAR(500),
    is_visible      BOOLEAN NOT NULL DEFAULT FALSE,
    start_dk        DECIMAL(10,3),
    end_dk          DECIMAL(10,3),
    completion_pct  DECIMAL(5,2) DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_support_tunnel ON support_components(tunnel_id);
CREATE INDEX idx_support_dk ON support_components(tunnel_id, start_dk, end_dk);

-- ============================================================
-- 13. Wind Field Simulations
-- ============================================================
CREATE TABLE wind_field_simulations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tunnel_id       UUID NOT NULL REFERENCES tunnels(id) ON DELETE CASCADE,
    name            VARCHAR(300) NOT NULL,
    start_dk        DECIMAL(10,3) NOT NULL,
    end_dk          DECIMAL(10,3) NOT NULL,
    streamline_url  VARCHAR(500),
    vector_data_url VARCHAR(500),
    software        VARCHAR(50) DEFAULT 'ANSYS CFX',
    total_curves    INTEGER,
    sampled_curves  INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 14. Processing Jobs
-- ============================================================
CREATE TABLE processing_jobs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_type_code VARCHAR(40) NOT NULL REFERENCES geological_model_types(code),
    tunnel_id       UUID REFERENCES tunnels(id),
    status          VARCHAR(30) NOT NULL DEFAULT 'pending',
    progress        SMALLINT NOT NULL DEFAULT 0,
    status_message  TEXT,
    input_files     JSONB,
    output_files    JSONB,
    processing_logs JSONB,
    error_message   TEXT,
    result_model_instance_id UUID REFERENCES geological_model_instances(id),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(100)
);
CREATE INDEX idx_jobs_status ON processing_jobs(status);

-- ============================================================
-- 15. Alerts
-- ============================================================
CREATE TABLE alerts (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id   UUID NOT NULL,
    title       VARCHAR(300) NOT NULL,
    description TEXT,
    level       VARCHAR(20) NOT NULL,
    tunnel_id   UUID REFERENCES tunnels(id),
    dk_number   DECIMAL(10,3),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolution_note TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_alerts_active ON alerts(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_alerts_entity ON alerts(entity_type, entity_id);

-- ============================================================
-- 16. Scene Config (replaces hardcoded SCENE_DATA)
-- ============================================================
CREATE TABLE scene_definitions (
    scene_key  VARCHAR(50) PRIMARY KEY,
    name_cn    VARCHAR(100) NOT NULL,
    icon       VARCHAR(10),
    color      VARCHAR(20),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE scene_metrics (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scene_key     VARCHAR(50) NOT NULL REFERENCES scene_definitions(scene_key),
    label         VARCHAR(100) NOT NULL,
    metric_key    VARCHAR(50),
    unit          VARCHAR(30),
    display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE scene_status_items (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scene_key     VARCHAR(50) NOT NULL REFERENCES scene_definitions(scene_key),
    label         VARCHAR(100) NOT NULL,
    val           VARCHAR(50),
    pct           DECIMAL(5,2) DEFAULT 0,
    level         VARCHAR(20) DEFAULT 'info',
    display_order INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 17. Users and Audit
-- ============================================================
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username      VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(100) NOT NULL,
    role          VARCHAR(30) NOT NULL DEFAULT 'viewer',
    email         VARCHAR(200),
    phone         VARCHAR(20),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES users(id),
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id   UUID,
    details     JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_user ON audit_log(user_id, created_at DESC);

-- ============================================================
-- 18. System Config
-- ============================================================
CREATE TABLE system_config (
    config_key   VARCHAR(100) PRIMARY KEY,
    config_value TEXT NOT NULL,
    description  TEXT,
    category     VARCHAR(50) NOT NULL DEFAULT 'general',
    is_public    BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Auto updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tunnels_updated_at BEFORE UPDATE ON tunnels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_worksites_updated_at BEFORE UPDATE ON worksites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_geo_models_updated_at BEFORE UPDATE ON geological_model_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_blast_designs_updated_at BEFORE UPDATE ON blast_designs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_support_updated_at BEFORE UPDATE ON support_components
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_system_config_updated_at BEFORE UPDATE ON system_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
