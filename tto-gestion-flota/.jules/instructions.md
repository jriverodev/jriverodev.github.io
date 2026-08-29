
# Sistema de Diseño y Guía de Estilo para Google Jules

Al analizar, refactorizar o generar código frontend (HTML, CSS, Tailwind) en este repositorio, debes cumplir estrictamente con el sistema de diseño "Sin Vibecoded" y la gestión de temas dinámicos.

## 1. Definición de Paleta y Mapeo de Temas (Light / Dark Mode)

El cambio entre modo claro y oscuro se gestiona exclusivamente a través de las variables globales definidas en `styles/tokens.css` o modificadores de Tailwind (`dark:`). Debe mantenerse un contraste mínimo de 4.5:1 en ambos temas.

### Variables por Modo (Reference Mapping)
- **Modo Oscuro (Default):**
  - Fondo App: `--bg-app` (`#0f172a` / Slate 900)
  - Superficie / Tarjetas: `--bg-surface` (`#1e293b` / Slate 800)
  - Bordes: `--border-dim` (`#334155` / Slate 700)
  - Texto Principal: `--text-main` (`#f8fafc` / Slate 50)
  - Texto Secundario: `--text-muted` (`#94a3b8` / Slate 400)
- **Modo Claro:**
  - Fondo App: `--bg-app` (`#f8fafc` / Slate 50)
  - Superficie / Tarjetas: `--bg-surface` (`#ffffff` / White)
  - Bordes: `--border-dim` (`#e2e8f0` / Slate 200)
  - Texto Principal: `--text-main` (`#0f172a` / Slate 900)
  - Texto Secundario: `--text-muted` (`#64748b` / Slate 500)
- **Color de Marca Operativo (Invariable entre modos):**
  - Primario: `--brand-solid` (`#2563eb` / Blue 600)
  - Hover: `--brand-hover` (`#1d4ed8` / Blue 700)

## 2. Reglas Visuales Obligatorias (Prohibiciones)
- **Color y Gradientes:** Prohibido el uso de degradados de dos colores (`from-purple-500 to-blue-500`) y de tonos morados/índigo genéricos (`#7c3aed`). 
- **Geometría:** El `border-radius` máximo permitido es 8px (`rounded-lg` o `rounded-md`). Estrictamente prohibido usar `rounded-xl`, `rounded-2xl` o `rounded-3xl`.
- **Efectos:** Prohibido el uso de desenfoques de fondo (`backdrop-filter`, `backdrop-blur`), bordes translúcidos (`rgba(255,255,255,0.1)`) y sombras de color debajo de los botones.
- **Botones e Iconografía:** No agregar flechas decorativas automáticas (`->`, `→`) en botones de acción. Los iconos deben pertenecer a un solo set (Lucide o Heroicons) en color pleno. Prohibido usar emojis como elementos de interfaz.

## 3. Implementación Estructural en Código

Al escribir componentes con soporte de modo claro/oscuro:
1. Asegúrate de declarar ambas variantes si usas clases utilitarias:
   `bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 border-slate-200 dark:border-slate-800`
2. Si utilizas variables CSS, asigna las clases en el `:root` y en la clase `.dark`:

```css
:root {
  --bg-app: #f8fafc;
  --bg-surface: #ffffff;
  --border-dim: #e2e8f0;
  --text-main: #0f172a;
  --text-muted: #64748b;
}

.dark {
  --bg-app: #0f172a;
  --bg-surface: #1e293b;
  --border-dim: #334155;
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
}
