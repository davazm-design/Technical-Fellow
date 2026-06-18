# Terraform — estructura neutral (minimiza lock-in)

La lógica de deploy vive en código versionado (no en clicks de consola). Estructura pensada para que
**portar = cambiar de adapter**, no reescribir.

```
terraform/
├── main.tf            # módulo "container_service" agnóstico + selección de adapter por var
├── variables.tf       # image, env_vars (sin secretos), region, cpu, memory, target_cloud
├── outputs.tf         # url del servicio, etc.
├── backend.tf         # state REMOTO cifrado (S3/GCS/Azure) — nunca state en git
└── adapters/
    ├── cloudrun/      # GCP Cloud Run
    ├── fargate/       # AWS ECS Fargate
    └── containerapps/ # Azure Container Apps
```

## Reglas

- **State remoto cifrado.** `terraform.tfstate` jamás en git (contiene metadata sensible).
- **Secretos fuera de Terraform.** Se referencian desde el secret manager de la nube vía el
  `secret_provider` port; nunca como variables en claro ni en el state.
- **Un solo `target_cloud`** selecciona el adapter. La misma imagen Docker corre en los tres.
- **`plan` → revisión humana → `apply`.** A prod, `apply` sólo con autorización humana explícita
  (ver `.claude/commands/deploy.md`).

## Lo que NO portas con esto (sé honesto)
IAM/roles, topología de red (VPC/SG), y observabilidad cambian por nube. Terraform los expresa, pero
se re-escriben por proveedor. El kit porta el 80% (imagen + datos + deploy de contenedor); el 20%
(IAM/red/observabilidad) siempre cuesta. Ver `docs/CLOUD-PORTABILITY.md`.
