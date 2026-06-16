// Hacktrack — i18n mínimo es-MX / en-US (item 443)
// ~50 strings clave de UI. Sin biblioteca externa — objeto simple con selector de idioma.
// Ampliar según necesidad; el guard TS garantiza que ambos idiomas tengan las mismas keys.

import type { AppLang } from './types'

export interface I18nStrings {
  // Navegación / tabs
  nav_inicio: string
  nav_diario: string
  nav_protocolo: string
  nav_vida: string
  nav_comida: string
  nav_semana: string

  // Encabezados de sección
  sec_ajustes: string
  sec_perfil: string
  sec_apariencia: string
  sec_privacidad: string
  sec_notificaciones: string
  sec_mis_productos: string
  sec_datos: string
  sec_soporte: string

  // Acciones comunes
  act_guardar: string
  act_cancelar: string
  act_confirmar: string
  act_borrar: string
  act_editar: string
  act_agregar: string
  act_registrar: string
  act_exportar: string
  act_importar: string
  act_compartir: string
  act_deshacer: string
  act_cerrar: string

  // Registro / formularios
  lbl_dosis: string
  lbl_medida: string
  lbl_nota: string
  lbl_fecha: string
  lbl_hora: string
  lbl_producto: string
  lbl_unidad: string
  lbl_valor: string

  // Ajustes de apariencia
  theme_auto: string
  theme_light: string
  theme_dark: string
  lang_es: string
  lang_en: string
  font_sm: string
  font_md: string
  font_lg: string
  units_metric: string
  units_imperial: string

  // Recordatorios
  notif_enabled: string
  notif_disabled: string
  notif_dose: string
  notif_measure: string
  notif_rescue: string

  // Disclaimers
  disclaimer_dose: string
  disclaimer_general: string

  // Logros / racha
  streak_days: string
  achievement_unlocked: string

  // Mensajes de estado
  msg_no_data: string
  msg_loading: string
  msg_saved: string
  msg_error: string

  // Paywall / trial
  paywall_trial: string
  paywall_cta: string
}

const ES: I18nStrings = {
  nav_inicio:      'Inicio',
  nav_diario:      'Diario',
  nav_protocolo:   'Protocolo',
  nav_vida:        'Vida',
  nav_comida:      'Comida',
  nav_semana:      'Semana',

  sec_ajustes:        'Ajustes',
  sec_perfil:         'Perfil',
  sec_apariencia:     'Apariencia',
  sec_privacidad:     'Privacidad',
  sec_notificaciones: 'Notificaciones',
  sec_mis_productos:  'Mis productos',
  sec_datos:          'Mis datos',
  sec_soporte:        'Soporte y feedback',

  act_guardar:    'Guardar',
  act_cancelar:   'Cancelar',
  act_confirmar:  'Confirmar',
  act_borrar:     'Borrar',
  act_editar:     'Editar',
  act_agregar:    'Agregar',
  act_registrar:  'Registrar',
  act_exportar:   'Exportar',
  act_importar:   'Importar',
  act_compartir:  'Compartir',
  act_deshacer:   'Deshacer',
  act_cerrar:     'Cerrar',

  lbl_dosis:    'Dosis',
  lbl_medida:   'Medida',
  lbl_nota:     'Nota',
  lbl_fecha:    'Fecha',
  lbl_hora:     'Hora',
  lbl_producto: 'Producto',
  lbl_unidad:   'Unidad',
  lbl_valor:    'Valor',

  theme_auto:  'Automático',
  theme_light: 'Claro',
  theme_dark:  'Oscuro',
  lang_es:     'Español',
  lang_en:     'English',
  font_sm:     'Pequeño',
  font_md:     'Normal',
  font_lg:     'Grande',
  units_metric:   'Métrico (kg, cm)',
  units_imperial: 'Imperial (lb, ft)',

  notif_enabled:  'Recordatorios activados',
  notif_disabled: 'Recordatorios desactivados',
  notif_dose:     'Recordatorio de dosis',
  notif_measure:  'Recordatorio de medida',
  notif_rescue:   'Recordatorio de seguimiento',

  disclaimer_dose:    'Tú registras tu propia dosis. Hacktrack no la calcula ni la prescribe.',
  disclaimer_general: 'Hacktrack es una herramienta de auto-registro. No es consejo médico.',

  streak_days:           'días de racha',
  achievement_unlocked:  '¡Logro desbloqueado!',

  msg_no_data: 'Sin datos aún',
  msg_loading: 'Cargando…',
  msg_saved:   'Guardado',
  msg_error:   'Ocurrió un error',

  paywall_trial: 'días de prueba gratuita',
  paywall_cta:   'Activar Hacktrack Plus',
}

const EN: I18nStrings = {
  nav_inicio:      'Home',
  nav_diario:      'Journal',
  nav_protocolo:   'Protocol',
  nav_vida:        'Life',
  nav_comida:      'Food',
  nav_semana:      'Week',

  sec_ajustes:        'Settings',
  sec_perfil:         'Profile',
  sec_apariencia:     'Appearance',
  sec_privacidad:     'Privacy',
  sec_notificaciones: 'Notifications',
  sec_mis_productos:  'My products',
  sec_datos:          'My data',
  sec_soporte:        'Support & feedback',

  act_guardar:    'Save',
  act_cancelar:   'Cancel',
  act_confirmar:  'Confirm',
  act_borrar:     'Delete',
  act_editar:     'Edit',
  act_agregar:    'Add',
  act_registrar:  'Log',
  act_exportar:   'Export',
  act_importar:   'Import',
  act_compartir:  'Share',
  act_deshacer:   'Undo',
  act_cerrar:     'Close',

  lbl_dosis:    'Dose',
  lbl_medida:   'Measurement',
  lbl_nota:     'Note',
  lbl_fecha:    'Date',
  lbl_hora:     'Time',
  lbl_producto: 'Product',
  lbl_unidad:   'Unit',
  lbl_valor:    'Value',

  theme_auto:  'Automatic',
  theme_light: 'Light',
  theme_dark:  'Dark',
  lang_es:     'Español',
  lang_en:     'English',
  font_sm:     'Small',
  font_md:     'Normal',
  font_lg:     'Large',
  units_metric:   'Metric (kg, cm)',
  units_imperial: 'Imperial (lb, ft)',

  notif_enabled:  'Reminders on',
  notif_disabled: 'Reminders off',
  notif_dose:     'Dose reminder',
  notif_measure:  'Measurement reminder',
  notif_rescue:   'Follow-up reminder',

  disclaimer_dose:    'You log your own dose. Hacktrack does not calculate or prescribe.',
  disclaimer_general: 'Hacktrack is a self-tracking tool. Not medical advice.',

  streak_days:           'day streak',
  achievement_unlocked:  'Achievement unlocked!',

  msg_no_data: 'No data yet',
  msg_loading: 'Loading…',
  msg_saved:   'Saved',
  msg_error:   'Something went wrong',

  paywall_trial: 'day free trial',
  paywall_cta:   'Activate Hacktrack Plus',
}

const STRINGS: Record<AppLang, I18nStrings> = { es: ES, en: EN }

/** Devuelve el diccionario de strings para el idioma solicitado (default: 'es'). */
export function useStrings(lang: AppLang | undefined): I18nStrings {
  return STRINGS[lang ?? 'es'] ?? STRINGS.es
}

/** Alias más corto para uso fuera de componentes React. */
export function t(lang: AppLang | undefined, key: keyof I18nStrings): string {
  return useStrings(lang)[key]
}
