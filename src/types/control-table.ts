// Control Table definitions for different servo models

export interface ControlTableEntry {
  address: number;
  size: number; // size in bytes
}

export interface ControlTableDefinition {
  [key: string]: ControlTableEntry;
}

// SCS/STS Series Control Table (including STS3215)
export const SCS_SERIES_CONTROL_TABLE: ControlTableDefinition = {
  // EEPROM Area
  Model: { address: 3, size: 2 },
  ID: { address: 5, size: 1 },
  Baud_Rate: { address: 6, size: 1 },
  Return_Delay: { address: 7, size: 1 },
  Response_Status_Level: { address: 8, size: 1 },
  Min_Angle_Limit: { address: 9, size: 2 },
  Max_Angle_Limit: { address: 11, size: 2 },
  Max_Temperature_Limit: { address: 13, size: 1 },
  Max_Voltage_Limit: { address: 14, size: 1 },
  Min_Voltage_Limit: { address: 15, size: 1 },
  Max_Torque_Limit: { address: 16, size: 2 },
  Phase: { address: 18, size: 1 },
  Unloading_Condition: { address: 19, size: 1 },
  LED_Alarm_Condition: { address: 20, size: 1 },
  P_Coefficient: { address: 21, size: 1 },
  D_Coefficient: { address: 22, size: 1 },
  I_Coefficient: { address: 23, size: 1 },
  Minimum_Startup_Force: { address: 24, size: 2 },
  CW_Dead_Zone: { address: 26, size: 1 },
  CCW_Dead_Zone: { address: 27, size: 1 },
  Protection_Current: { address: 28, size: 2 },
  Angular_Resolution: { address: 30, size: 1 },
  Offset: { address: 31, size: 2 },
  Mode: { address: 33, size: 1 },
  Protective_Torque: { address: 34, size: 1 },
  Protection_Time: { address: 35, size: 1 },
  Overload_Torque: { address: 36, size: 1 },
  Speed_closed_loop_P_proportional_coefficient: { address: 37, size: 1 },
  Over_Current_Protection_Time: { address: 38, size: 1 },
  Velocity_closed_loop_I_integral_coefficient: { address: 39, size: 1 },
  
  // RAM Area
  Torque_Enable: { address: 40, size: 1 },
  Acceleration: { address: 41, size: 1 },
  Goal_Position: { address: 42, size: 2 },
  Goal_Time: { address: 44, size: 2 },
  Goal_Speed: { address: 46, size: 2 },
  Torque_Limit: { address: 48, size: 2 },
  Lock: { address: 55, size: 1 },
  Present_Position: { address: 56, size: 2 },
  Present_Speed: { address: 58, size: 2 },
  Present_Load: { address: 60, size: 2 },
  Present_Voltage: { address: 62, size: 1 },
  Present_Temperature: { address: 63, size: 1 },
  Status: { address: 65, size: 1 },
  Moving: { address: 66, size: 1 },
  Present_Current: { address: 69, size: 2 },
  Maximum_Acceleration: { address: 85, size: 2 },
};

// Model-specific control tables
export const MODEL_CONTROL_TABLE: Record<string, ControlTableDefinition> = {
  scs_series: SCS_SERIES_CONTROL_TABLE,
  sts3215: SCS_SERIES_CONTROL_TABLE,
  sms_series: SCS_SERIES_CONTROL_TABLE,
};

// Model resolutions (steps for full rotation)
export const MODEL_RESOLUTION: Record<string, number> = {
  scs_series: 4096,
  sts3215: 4096,
  sms_series: 4096,
};

// Baudrate tables for different models
export const SCS_SERIES_BAUDRATE_TABLE: Record<number, number> = {
  0: 1_000_000,
  1: 500_000,
  2: 250_000,
  3: 128_000,
  4: 115_200,
  5: 57_600,
  6: 38_400,
  7: 19_200,
};

export const MODEL_BAUDRATE_TABLE: Record<string, Record<number, number>> = {
  scs_series: SCS_SERIES_BAUDRATE_TABLE,
  sts3215: SCS_SERIES_BAUDRATE_TABLE,
  sms_series: SCS_SERIES_BAUDRATE_TABLE,
};

// Control table keys that require calibration
export const CALIBRATION_REQUIRED = ['Goal_Position', 'Present_Position'];

// Control table keys that need uint32 to int32 conversion
export const CONVERT_UINT32_TO_INT32_REQUIRED = ['Goal_Position', 'Present_Position'];

// Helper function to get control table entry for a specific model and data name
export function getControlTableEntry(model: string, dataName: string): ControlTableEntry | undefined {
  const controlTable = MODEL_CONTROL_TABLE[model];
  if (!controlTable) {
    throw new Error(`Unknown model: ${model}`);
  }
  return controlTable[dataName];
}

// Helper function to validate if all models have the same address for a data name
export function assertSameAddress(models: string[], dataName: string): void {
  const addresses = new Set<number>();
  const sizes = new Set<number>();

  for (const model of models) {
    const entry = getControlTableEntry(model, dataName);
    if (!entry) {
      throw new Error(`Data name '${dataName}' not found for model '${model}'`);
    }
    addresses.add(entry.address);
    sizes.add(entry.size);
  }

  if (addresses.size > 1) {
    throw new Error(
      `Different models use different addresses for '${dataName}'. This is not supported.`
    );
  }

  if (sizes.size > 1) {
    throw new Error(
      `Different models use different byte sizes for '${dataName}'. This is not supported.`
    );
  }
}