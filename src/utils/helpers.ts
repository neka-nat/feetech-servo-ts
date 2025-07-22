import { MIN_POSITION_VALUE, MAX_POSITION_VALUE, MIN_SPEED_VALUE, MAX_SPEED_VALUE } from '../core/constants';
import { MODEL_RESOLUTION, MODEL_CONFIGS } from '../types';

export function degreesToPosition(degrees: number, model: string = 'scs_series'): number {
  // Convert degrees to position value based on model resolution
  const resolution = MODEL_RESOLUTION[model] || 4096;
  return Math.round((degrees / 360) * resolution);
}

export function positionToDegrees(position: number, model: string = 'scs_series'): number {
  // Convert position value to degrees based on model resolution
  const resolution = MODEL_RESOLUTION[model] || 4096;
  return (position / resolution) * 360;
}

export function rpmToSpeed(rpm: number): number {
  // Convert RPM to speed value (0-1023)
  // Max RPM is approximately 114 for most Feetech servos
  return Math.round((rpm / 114) * MAX_SPEED_VALUE);
}

export function speedToRpm(speed: number): number {
  // Convert speed value (0-1023) to RPM
  return (speed / MAX_SPEED_VALUE) * 114;
}

export function getModelMaxPosition(model: string = 'scs_series'): number {
  return MODEL_CONFIGS[model]?.maxPosition ?? MAX_POSITION_VALUE;
}

export function getModelMinPosition(model: string = 'scs_series'): number {
  return MODEL_CONFIGS[model]?.minPosition ?? MIN_POSITION_VALUE;
}

export function clampPosition(position: number, model: string = 'scs_series'): number {
  const min = getModelMinPosition(model);
  const max = getModelMaxPosition(model);
  return Math.max(min, Math.min(max, position));
}

export function clampSpeed(speed: number): number {
  return Math.max(MIN_SPEED_VALUE, Math.min(MAX_SPEED_VALUE, speed));
}

export function validateServoId(id: number): void {
  if (id < 0 || id > 253) {
    throw new Error(`Invalid servo ID: ${id}. Must be between 0 and 253.`);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function calculateChecksum(data: Uint8Array): number {
  let sum = 0;
  for (const byte of data) {
    sum += byte;
  }
  return (~sum) & 0xFF;
}

export function convertDegreesToSteps(degrees: number | number[], models: string | string[]): number[] {
  // Convert degrees to motor steps based on model resolution
  const degreeArray = Array.isArray(degrees) ? degrees : [degrees];
  const modelArray = Array.isArray(models) ? models : [models];
  
  const steps = degreeArray.map((deg, i) => {
    const model = modelArray[i] || modelArray[0];
    const resolution = MODEL_RESOLUTION[model] || 4096;
    return Math.round((deg / 180) * (resolution / 2));
  });
  
  return steps;
}

export function formatHex(value: number, padLength = 2): string {
  return `0x${value.toString(16).padStart(padLength, '0').toUpperCase()}`;
}

export function bytesToHexString(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(byte => formatHex(byte))
    .join(' ');
}

export function isWebSerialSupported(): boolean {
  return 'serial' in navigator;
}

export async function requestPort(): Promise<SerialPort | null> {
  if (!isWebSerialSupported()) {
    throw new Error('Web Serial API is not supported in this browser');
  }

  try {
    return await navigator.serial.requestPort();
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      return null; // User cancelled
    }
    throw error;
  }
}

const SCS_SERIES_BAUD_TABLE: Record<number, number> = {
  0: 1_000_000,
  1: 500_000,
  2: 250_000,
  3: 128_000,
  4: 115_200,
  5: 57_600,
  6: 38_400,
  7: 19_200,
};

export function getBaudRateValue(baudRate: number): number {
  for (const [regStr, baud] of Object.entries(SCS_SERIES_BAUD_TABLE)) {
    if (baud === baudRate) return Number(regStr);
  }
  throw new Error(`Unsupported baud rate ${baudRate}`);
}

export function getActualBaudRate(registerValue: number): number {
  return SCS_SERIES_BAUD_TABLE[registerValue] ?? 0;
}