// Motor model configuration types

export interface MotorConfig {
  id: number;
  model: string;
  name?: string;
}

export interface MotorsConfig {
  [motorName: string]: {
    id: number;
    model: string;
  };
}

export enum CalibrationMode {
  DEGREE = 'DEGREE',  // For rotational joints (-180 to 180 degrees)
  LINEAR = 'LINEAR',  // For linear joints like grippers (0 to 100%)
}

export enum DriveMode {
  NORMAL = 0,
  INVERTED = 1,
}

export interface CalibrationData {
  motor_names: string[];
  calib_mode: CalibrationMode[];
  drive_mode: DriveMode[];
  homing_offset: number[];
  start_pos?: number[];  // For LINEAR mode
  end_pos?: number[];    // For LINEAR mode
}

// Supported motor models
export enum MotorModel {
  SCS_SERIES = 'scs_series',
  STS3215 = 'sts3215',
  SMS_SERIES = 'sms_series',
}

// Model-specific configurations
export interface ModelConfig {
  resolution: number;
  maxPosition: number;
  minPosition: number;
  defaultBaudRate: number;
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  [MotorModel.SCS_SERIES]: {
    resolution: 4096,
    maxPosition: 4095,
    minPosition: 0,
    defaultBaudRate: 1_000_000,
  },
  [MotorModel.STS3215]: {
    resolution: 4096,
    maxPosition: 4095,
    minPosition: 0,
    defaultBaudRate: 1_000_000,
  },
  [MotorModel.SMS_SERIES]: {
    resolution: 4096,
    maxPosition: 4095,
    minPosition: 0,
    defaultBaudRate: 1_000_000,
  },
};