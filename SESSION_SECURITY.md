# SEGURIDAD DE SESIONES Y PROTECCIÓN BRUTE FORCE

1. **Protección Brute Force:**
   - 5 intentos fallidos consecutivos de login inactivan temporalmente la cuenta (`LOCKED`).
   - Periodo de bloqueo: 15 minutos (`lockoutUntil`).
   - Respuestas de error estandarizadas para prevenir enumeración de cuentas.

2. **Seguridad de Sesión Multi-dispositivo (`user_sessions`):**
   - Identificación de dispositivo (`deviceId`, `deviceName`, `ipAddress`, `userAgent`).
   - Almacenamiento seguro mediante hash SHA-256 de los refresh tokens.
