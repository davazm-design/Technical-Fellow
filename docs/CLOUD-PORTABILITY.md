# Portabilidad cloud (AWS / Azure / GCP)

## La verdad cruda

"Portar sin fricción" entre las tres nubes es **parcialmente un mito**. Siempre hay fricción en
IAM, redes, secretos y observabilidad. Lo que sí es real y alcanzable: **portar el núcleo de la app
(código + datos + deploy) sin reescribir lógica de negocio.** Eso se decide en el stack desde el
día 1, no en el deploy al final.

## Decisiones del kit para minimizar lock-in

| Capa | Elección portable | Qué evitar (lock-in) |
|---|---|---|
| Runtime | **Contenedor Docker** como unidad de deploy | Lambda / Cloud Functions / Azure Functions con su shape propietaria en el núcleo |
| Orquestación de contenedor | ECS/Fargate · Cloud Run · Azure Container Apps (los tres corren la misma imagen) | Primitivas de scheduling propietarias en la lógica |
| Base de datos | **Postgres puro** (RDS · Cloud SQL · Azure DB for Postgres) | Extensiones propietarias, DynamoDB/Cosmos/Spanner en el camino crítico |
| Backend | Framework agnóstico sobre Node (ej. Hono) | SDKs de nube en el dominio; aíslalos tras una interfaz |
| Frontend | **SPA estática** (React + Vite) servida por contenedor o bucket+CDN (S3/GCS/Blob) | SSR atado al runtime de hosting de una nube específica |
| Storage de objetos | Interfaz `BlobStore` con impl S3-compatible | Llamar al SDK de un proveedor directo desde el dominio |
| Secretos | Vía variables de entorno + interfaz `SecretProvider` | Leer de Secrets Manager/Key Vault directo en el código |
| Infra | **Terraform** desde el piloto | Configuración por consola (clicks no versionables) |

## Regla de arquitectura: el patrón "puerto/adaptador" para servicios de nube

Cualquier dependencia de nube (storage, colas, email, secretos) entra al dominio **sólo a través de
una interfaz** (`port`) cuya implementación (`adapter`) es intercambiable por proveedor. Así portar =
escribir un adapter nuevo, no tocar el dominio.

```
domain ──► interface BlobStore ──► S3Adapter | GCSAdapter | AzureBlobAdapter
domain ──► interface Mailer    ──► SesAdapter | SendgridAdapter | ...
```

El `/architect` debe declarar, cuando un plan toca un servicio de nube, qué `port` usa y qué adapter
lo implementa. El `/security` verifica que el dominio no llame SDKs de proveedor directo.

## Lo que NO portas sin trabajo (sé honesto con el usuario)

- IAM / permisos de la nube — se reescriben por proveedor.
- Observabilidad (CloudWatch vs Cloud Logging vs Azure Monitor) — abstraíble con OpenTelemetry, pero
  el backend de métricas cambia.
- Networking (VPC, security groups) — Terraform ayuda, pero la topología se re-expresa.

El kit minimiza la fricción del 80% (código + datos + deploy de contenedor); el 20% restante
(IAM/red/observabilidad) siempre cuesta. Decláralo cuando el usuario pregunte, no lo ocultes.
