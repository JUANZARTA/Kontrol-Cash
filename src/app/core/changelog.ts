export interface ChangelogEntry {
  version: string;
  fecha: string;
  cambios: string[];
}

/** Notas de versión de Kontrol Cash, de la más nueva a la más vieja. Solo cambios notorios para el usuario. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.2.4',
    fecha: '10/10/2026',
    cambios: [
      'Ingreso con huella en celular, como bloqueo rápido de la app.',
      'Notas de versión en Configuración, con el historial de cambios de la app.',
    ],
  },
  {
    version: '2.2.3',
    fecha: '09/10/2026',
    cambios: [
      'Menú lateral con modo colapsado en escritorio, que se recuerda entre visitas.',
      'Descarga en PDF del cierre de mes con todas las categorías.',
      'Subgastos: desglosá un gasto en partes más chicas.',
      'Cuenta "Monedero" fija por defecto en Billetera.',
      'Deudas y deudores: desglose de cuotas como parte de las acciones.',
      'Arreglo: se corrigen las gráficas de rendimiento de Vehículo y se agrega alcance por mes.',
      'Arreglo: la fecha se sincroniza con el mes pendiente antes de cerrarlo.',
    ],
  },
  {
    version: '2.2.2',
    fecha: '21/09/2026',
    cambios: [
      'La versión de la app ahora se ve en el pie de página.',
      'Las deudas y cuotas pagadas se muestran opacadas en la tabla.',
      'Opción "Descuadre" en los selectores de billetera de Gastos y Vehículo.',
      'Arreglo: la sesión se cierra sola cuando el token vence, en vez de quedar trabada.',
      'Arreglo: el menú de acciones de Facturas se cierra al tocar afuera.',
      'Arreglo: se corrige el estado financiero (badge) en Vehículo y Estadísticas.',
    ],
  },
  {
    version: '2.2.1',
    fecha: '01/09/2026',
    cambios: [
      'El cierre de mes pasa a ser obligatorio y manual, ya no se cierra solo.',
      'Billetera: podés mover todo el saldo o un valor que elijas a otra billetera.',
      'Gastos: filtros de búsqueda, categoría y comparación en la tabla.',
      'Arreglo en Vehículo: se descuenta bien la billetera en los gastos y se corrige el rendimiento por tanque y por galón.',
    ],
  },
  {
    version: '2.2.0',
    fecha: '25/07/2026',
    cambios: [
      'La app se renueva de marca: ahora se llama Kontrol Cash, con ícono nuevo.',
      'Inicio de sesión rediseñado en dos columnas para escritorio.',
      'Se repiensa el flujo de cierre de mes.',
    ],
  },
  {
    version: '2.1.0',
    fecha: '27/05/2026',
    cambios: [
      'Kontrol Cash ya se puede instalar como app (PWA), en Android y iPhone.',
      'Nuevo módulo de Vehículo: control de gasolina, kilometraje, estimación y gráficas de rendimiento.',
      'Nueva sección Configuración: perfil, foto de perfil y color de acento personalizado.',
      'Modo invitado para probar la app sin crear una cuenta.',
      'Selección múltiple en las tablas, para editar o borrar en bloque.',
      'Cargá un gasto escaneando la foto de una factura.',
      'Categorías para tus gastos.',
      'Deudas y deudores asociados a una billetera.',
      'Adjuntá comprobantes a tus gastos y marcá prioridad en tus deudas.',
      'Gráfica de tanqueos en Vehículo.',
    ],
  },
  {
    version: '2.0.0',
    fecha: '30/04/2026',
    cambios: [
      'Rediseño grande de la app: arquitectura reorganizada y estilos renovados en encabezado, menú lateral y pie de página.',
      'Modo oscuro en toda la app.',
      'Planificador de ingresos, gastos y ahorros con aportes programados.',
      'Resumen financiero en Inicio.',
    ],
  },
  {
    version: '1.2.0',
    fecha: '03/02/2026',
    cambios: [
      'Cierre de mes: cerrás el mes actual y arrancás el siguiente limpio.',
      'Inicio de sesión con Google.',
      'Mejoras de seguridad en el guardado de tus datos.',
    ],
  },
  {
    version: '1.1.0',
    fecha: '15/11/2025',
    cambios: [
      'Nueva sección de Facturas, con sus propios modales para crear y editar.',
      'Ingresos y Billetera ahora se manejan con transacciones.',
      'Rediseño de tablas, menú lateral y encabezado, con animaciones.',
      'Gráficos financieros en Inicio.',
      'Rediseño de las pantallas de inicio de sesión y registro.',
      'Podés sumarle o restarle valor a un gasto y descontarlo de una billetera.',
    ],
  },
  {
    version: '1.0.0',
    fecha: '14/08/2025',
    cambios: [
      'Primera versión de Kontrol Cash: Inicio, Billetera, Ingresos, Gastos, Ahorros, Deudas y Deudores.',
      'Registro e inicio de sesión con tu cuenta.',
      'Tus datos se guardan en la nube con Firebase.',
      'Notificaciones dentro de la app.',
    ],
  },
];
