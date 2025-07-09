export interface SerialOptions {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
}

export interface PingResult {
  id: number;
  modelNumber: number;
  firmwareVersion: number;
}

export interface ServoStatus {
  position: number;
  speed: number;
  load: number;
  voltage: number;
  temperature: number;
  moving: boolean;
  errorStatus: number;
}

export interface SyncWriteData {
  id: number;
  data: Uint8Array;
}

export interface SyncReadRequest {
  id: number;
  address: number;
  length: number;
}

export interface Packet {
  id: number;
  instruction: number;
  parameters: Uint8Array;
  length: number;
}

export interface ResponsePacket extends Packet {
  error: number;
  checksum: number;
}

export enum Instruction {
  PING = 0x01,
  READ = 0x02,
  WRITE = 0x03,
  REG_WRITE = 0x04,
  ACTION = 0x05,
  FACTORY_RESET = 0x06,
  REBOOT = 0x08,
  SYNC_WRITE = 0x83,
  SYNC_READ = 0x82,
}

export enum ErrorBit {
  VOLTAGE = 0x01,
  ANGLE = 0x02,
  OVERHEAT = 0x04,
  RANGE = 0x08,
  CHECKSUM = 0x10,
  OVERLOAD = 0x20,
  INSTRUCTION = 0x40,
}

// Re-export control table and model types
export * from './control-table';
export * from './models';

export class ServoError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public deviceId?: number
  ) {
    super(message);
    this.name = 'ServoError';
  }
}

export enum ErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_LOST = 'CONNECTION_LOST',
  PORT_NOT_FOUND = 'PORT_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  TIMEOUT = 'TIMEOUT',
  CHECKSUM_ERROR = 'CHECKSUM_ERROR',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  WRITE_ERROR = 'WRITE_ERROR',
  READ_ERROR = 'READ_ERROR',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  HARDWARE_ERROR = 'HARDWARE_ERROR',
}