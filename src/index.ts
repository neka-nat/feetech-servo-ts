import { WebSerialPortHandler } from './core/port-handler';
import { ProtocolHandler } from './core/protocol-handler';
import { GroupSyncWrite } from './sync/group-sync-write';
import { GroupSyncRead } from './sync/group-sync-read';
import { 
  SerialOptions, 
  PingResult, 
  ServoStatus, 
  ServoError, 
  ErrorCode,
  MotorsConfig,
  MotorModel,
  getControlTableEntry
} from './types';
import { 
  DEFAULT_BAUDRATE, 
  DEFAULT_TIMEOUT,
  makeWord,
  getLowByte,
  getHighByte
} from './core/constants';
import * as helpers from './utils/helpers';

export * from './types';
export * from './core/constants';
export * as helpers from './utils/helpers';

export interface FeetechServoConfig {
  port?: SerialOptions;
  motors?: MotorsConfig;
  defaultModel?: string;
  timeout?: number;
}

export class FeetechServo {
  private portHandler: WebSerialPortHandler;
  private protocolHandler: ProtocolHandler;
  private isConnected = false;
  private motors: MotorsConfig = {};
  private defaultModel: string;

  private getModelByServoId(id: number): string {
    for (const key in this.motors) {
      const m = this.motors[key];
      if (m.id === id) return m.model;
    }
    return this.defaultModel;
  }

  constructor(config: FeetechServoConfig = {}) {
    const { 
      port = { baudRate: DEFAULT_BAUDRATE },
      motors = {},
      defaultModel = MotorModel.SCS_SERIES,
      timeout = DEFAULT_TIMEOUT
    } = config;
    
    this.portHandler = new WebSerialPortHandler(port, timeout);
    this.protocolHandler = new ProtocolHandler(this.portHandler, timeout);
    this.motors = motors;
    this.defaultModel = defaultModel;
    this.protocolHandler.setModel(defaultModel);
  }

  setMotors(motors: MotorsConfig): void {
    this.motors = motors;
  }

  getMotorModel(motorName: string): string {
    if (this.motors[motorName]) {
      return this.motors[motorName].model;
    }
    return this.defaultModel;
  }

  setDefaultModel(model: string): void {
    this.defaultModel = model;
    this.protocolHandler.setModel(model);
  }

  async connect(): Promise<void> {
    await this.portHandler.connect();
    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    await this.portHandler.disconnect();
    this.isConnected = false;
  }

  getConnectionStatus(): boolean {
    return this.isConnected && this.portHandler.isConnected();
  }

  async ping(id: number): Promise<PingResult> {
    this.ensureConnected();
    return await this.protocolHandler.ping(id);
  }

  async scan(startId = 0, endId = 253): Promise<PingResult[]> {
    this.ensureConnected();
    const found: PingResult[] = [];

    for (let id = startId; id <= endId; id++) {
      try {
        const result = await this.ping(id);
        found.push(result);
      } catch (error) {
        // Skip non-responsive IDs
      }
    }

    return found;
  }

  async readPosition(id: number): Promise<number> {
    this.ensureConnected();
    return await this.protocolHandler.readPosition(id);
  }

  async writePosition(id: number, position: number, speed?: number): Promise<void> {
    this.ensureConnected();
    const model = this.getModelByServoId(id);
    const clampedPosition = helpers.clampPosition(position, model);
    const clampedSpeed = speed !== undefined ? helpers.clampSpeed(speed) : undefined;
    await this.protocolHandler.writePosition(id, clampedPosition, clampedSpeed);
  }

  async setPositionInDegrees(id: number, degrees: number, speed?: number): Promise<void> {
    const model = this.getModelByServoId(id);
    const position = helpers.degreesToPosition(degrees, model);
    await this.writePosition(id, position, speed);
  }

  async getPositionInDegrees(id: number): Promise<number> {
    const position = await this.readPosition(id);
    const model = this.getModelByServoId(id);
    return helpers.positionToDegrees(position, model);
  }

  async enableTorque(id: number): Promise<void> {
    this.ensureConnected();
    await this.protocolHandler.setTorque(id, true);
  }

  async disableTorque(id: number): Promise<void> {
    this.ensureConnected();
    await this.protocolHandler.setTorque(id, false);
  }

  async readStatus(id: number): Promise<ServoStatus> {
    this.ensureConnected();
    return await this.protocolHandler.readStatus(id);
  }

  async setID(id: number, newId: number): Promise<void> {
    this.ensureConnected();
    helpers.validateServoId(newId);
    await this.protocolHandler.setID(id, newId);
  }

  async setBaudRate(id: number, baudRate: number): Promise<void> {
    this.ensureConnected();
    await this.protocolHandler.setBaudRate(id, baudRate);
  }

  async factoryReset(id: number): Promise<void> {
    this.ensureConnected();
    await this.protocolHandler.factoryReset(id);
  }

  async reboot(id: number): Promise<void> {
    this.ensureConnected();
    await this.protocolHandler.reboot(id);
  }

  createSyncWrite(address: number, dataLength: number): GroupSyncWrite {
    this.ensureConnected();
    return new GroupSyncWrite(this.portHandler, address, dataLength);
  }

  createSyncRead(address: number, dataLength: number): GroupSyncRead {
    this.ensureConnected();
    return new GroupSyncRead(this.portHandler, address, dataLength);
  }

  async syncWritePosition(positions: Array<{id: number, position: number}>): Promise<void> {
    this.ensureConnected();
    const entry = getControlTableEntry(this.defaultModel, 'Goal_Position');
    if (!entry) throw new ServoError('Goal_Position not found in control table', ErrorCode.INVALID_PARAMETER);
    
    const syncWrite = this.createSyncWrite(entry.address, entry.size);

    for (const item of positions) {
      const model = this.getModelByServoId(item.id);
      const clampedPosition = helpers.clampPosition(item.position, model);
      const data = new Uint8Array([
        getLowByte(clampedPosition),
        getHighByte(clampedPosition)
      ]);
      syncWrite.addParam(item.id, data);
    }

    await syncWrite.txPacket();
  }

  async syncReadPosition(ids: number[]): Promise<Map<number, number>> {
    this.ensureConnected();
    const entry = getControlTableEntry(this.defaultModel, 'Present_Position');
    if (!entry) throw new ServoError('Present_Position not found in control table', ErrorCode.INVALID_PARAMETER);
    
    const syncRead = this.createSyncRead(entry.address, entry.size);

    for (const id of ids) {
      syncRead.addParam(id);
    }

    await syncRead.txRxPacket();

    const results = new Map<number, number>();
    for (const id of ids) {
      const data = syncRead.getData(id);
      if (data && data.length >= 2) {
        results.set(id, makeWord(data[0], data[1]));
      }
    }

    return results;
  }

  async readByte(id: number, address: number): Promise<number> {
    this.ensureConnected();
    return await this.protocolHandler.readByte(id, address);
  }

  async writeByte(id: number, address: number, value: number): Promise<void> {
    this.ensureConnected();
    await this.protocolHandler.writeByte(id, address, value);
  }

  async readWord(id: number, address: number): Promise<number> {
    this.ensureConnected();
    return await this.protocolHandler.readWord(id, address);
  }

  async writeWord(id: number, address: number, value: number): Promise<void> {
    this.ensureConnected();
    await this.protocolHandler.writeWord(id, address, value);
  }

  async readData(id: number, address: number, length: number): Promise<Uint8Array> {
    this.ensureConnected();
    return await this.protocolHandler.readData(id, address, length);
  }

  async writeData(id: number, address: number, data: Uint8Array): Promise<void> {
    this.ensureConnected();
    await this.protocolHandler.writeData(id, address, data);
  }

  private ensureConnected(): void {
    if (!this.getConnectionStatus()) {
      throw new ServoError(
        'Not connected to serial port',
        ErrorCode.CONNECTION_LOST
      );
    }
  }
}

// Default export
export default FeetechServo;