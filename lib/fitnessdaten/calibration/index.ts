/** Re-exports für Offline-Kalibrierung. */

export {
  ladeCalibrationParams,
  speichereCalibrationParams,
  resetCalibrationParams,
  DEFAULT_CALIBRATION_PARAMS,
} from '@/lib/fitnessdaten/calibration/calibration-params'
export {
  ladeCalibrationLog,
  registriereCalibrationPair,
  calibrationStats,
  autoFitCalibrationParams,
  exportCalibrationJson,
} from '@/lib/fitnessdaten/calibration/calibration-log'
export { kalibriereGegenCloudPayload } from '@/lib/fitnessdaten/calibration/calibration-compare'
export {
  istOmniaOfflineMode,
  setzeOmniaOfflineMode,
  OMNIA_OFFLINE_MODE_EVENT,
} from '@/lib/fitnessdaten/calibration/omnia-offline-mode'
export {
  metricSourceFuer,
  metricSourceLabel,
  projektOfflineDisplay,
} from '@/lib/fitnessdaten/calibration/metric-source'
export {
  ladeDisplaySource,
  setzeDisplaySource,
  istOmniaAnzeige,
  projektDisplayFuerQuelle,
  DISPLAY_SOURCE_EVENT,
} from '@/lib/fitnessdaten/calibration/display-source'
export type { CalibrationMetric, CalibrationPair, CalibrationMetricStats } from '@/lib/fitnessdaten/calibration/calibration-types'
export type { CalibrationParams } from '@/lib/fitnessdaten/calibration/calibration-params'
export type { MetricSourceKind, MetricSourceKey } from '@/lib/fitnessdaten/calibration/metric-source'
export type { DisplaySource } from '@/lib/fitnessdaten/calibration/display-source'
