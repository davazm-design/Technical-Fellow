# Domain pack: pii

Checklist que `/security` añade cuando `kit.config.yaml domain_packs.enabled` incluye `pii`.
Para apps que manejan datos personales. Se combina con `compliance-*` si el marco legal aplica.

## Plan (Función 1) y ejecución (Función 2)

- [ ] PII (email, teléfono, nombres, documentos, datos de menores) **nunca** en logs estructurados.
      `grep -rn "logger\.(info|debug|warn|error).*\b(email|phone|name|password|token)\b"` → 0.
- [ ] PII **nunca** en prompts a LLM ni en mensajes de error al cliente.
- [ ] `Error.message` de librerías externas tratado como potencialmente con-PII: redactar/sanitizar
      antes de loguear (response sanitization ≠ log sanitization — son dos superficies).
- [ ] Campos PII identificados en el plan con cómo se protegen (encriptación/enmascaramiento/acceso por
      rol).
- [ ] Minimización: sólo se capturan los datos necesarios para el propósito declarado.

## Severidad
PII en logs o en prompts a LLM = **HIGH** mínimo; datos de menores = **CRITICAL**.
