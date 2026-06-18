# Data contract — feature <feature-slug>

> Lo produce `/architect` en modo contract-first. Lo implementa el lane `db`. Congelado durante la
> fase paralela (zona 🟠). El backend programa contra este modelo; no lo modifica.

## Entidades

### <Entidad>
| Columna | Tipo | Null | Default | Constraint | Notas |
|---------|------|------|---------|------------|-------|
| id | uuid | no | gen_random_uuid() | PK | |
| ... | | | | | |
| created_at | timestamptz | no | now() | | audit |
| updated_at | timestamptz | no | now() | | audit |
| deleted_at | timestamptz | sí | null | | soft delete |

## Relaciones (FKs)
| FK | Referencia | ON DELETE | Justificación |
|----|-----------|-----------|---------------|
| <col> | <tabla>(id) | RESTRICT / CASCADE / SET NULL | |

## Índices
| Índice | Columnas | Tipo | Parcial (WHERE) | Razón |
|--------|----------|------|-----------------|-------|
| | | btree/gin | deleted_at IS NULL | |

## Invariantes
- ...  (ej. "no puede existir más de un proceso activo por applicant")

## Migración
- Archivo destino: `migrations/00NN_<slug>.sql`
- Reversible: sí/no (justifica si no)
- Bloqueo en tablas grandes: usar `CREATE INDEX CONCURRENTLY` si > 100k filas
