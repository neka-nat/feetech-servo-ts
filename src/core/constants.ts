export const BROADCAST_ID = 0xFE;
export const MAX_ID = 0xFD;

export const HEADER = [0xFF, 0xFF];
export const HEADER_LENGTH = 2;
export const ID_LENGTH = 1;
export const LENGTH_LENGTH = 1;
export const INSTRUCTION_LENGTH = 1;
export const ERROR_LENGTH = 1;
export const CHECKSUM_LENGTH = 1;

export const MIN_PACKET_LENGTH = HEADER_LENGTH + ID_LENGTH + LENGTH_LENGTH + INSTRUCTION_LENGTH + CHECKSUM_LENGTH;

export const DEFAULT_BAUDRATE = 1000000;
export const DEFAULT_TIMEOUT = 1000; // ms
export const DEFAULT_RETRY_COUNT = 3;

export const LATENCY_TIMER = 8; // ms

export const TORQUE_ENABLE = 1;
export const TORQUE_DISABLE = 0;

export const MIN_POSITION_VALUE = 0;
export const MAX_POSITION_VALUE = 4095;
export const CENTER_POSITION_VALUE = 2048;

export const MIN_SPEED_VALUE = 0;
export const MAX_SPEED_VALUE = 1023;

export const VOLTAGE_UNIT = 0.1; // V
export const TEMPERATURE_UNIT = 1; // °C

export function makeWord(lowByte: number, highByte: number): number {
  return (highByte << 8) | lowByte;
}

export function getLowByte(word: number): number {
  return word & 0xFF;
}

export function getHighByte(word: number): number {
  return (word >> 8) & 0xFF;
}