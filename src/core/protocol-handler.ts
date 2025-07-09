import { WebSerialPortHandler } from './port-handler';
import { PacketHandler } from './packet-handler';
import { 
  PingResult, 
  ServoStatus, 
  ResponsePacket, 
  ServoError, 
  ErrorCode,
  Instruction,
  getControlTableEntry
} from '../types';
import { 
  makeWord, 
  getLowByte, 
  getHighByte, 
  TORQUE_ENABLE,
  TORQUE_DISABLE,
  DEFAULT_TIMEOUT,
  LATENCY_TIMER
} from './constants';
import { getBaudRateValue } from '../utils/helpers';

export class ProtocolHandler {
  private packetHandler: PacketHandler;
  private model: string = 'scs_series'; // Default model

  constructor(
    private portHandler: WebSerialPortHandler,
    private timeout: number = DEFAULT_TIMEOUT
  ) {
    this.packetHandler = new PacketHandler();
  }

  setModel(model: string): void {
    this.model = model;
  }

  private async sendAndReceive(packet: Uint8Array, expectedId: number): Promise<ResponsePacket> {
    await this.portHandler.flush();
    await this.portHandler.write(packet);

    while (true) {
      await this.portHandler.waitForData(buf => buf.length >= 2, this.timeout);
      const h = this.portHandler.peekBuffer(2);
      if (h[0] === 0xFF && h[1] === 0xFF) break;
      await this.portHandler.read(1);
    }

    const headerAndLen = await this.portHandler.read(4);
    const pktLen       = this.packetHandler.getPacketLength(headerAndLen);
    if (pktLen === null) {
      throw new ServoError('Invalid packet length', ErrorCode.INVALID_RESPONSE);
    }

    const payload  = await this.portHandler.read(pktLen - 4);
    const fullPacket = new Uint8Array(pktLen);
    fullPacket.set(headerAndLen);
    fullPacket.set(payload, 4);

    // Parse packet
    const response = this.packetHandler.parsePacket(fullPacket);

    // Verify ID
    if (response.id !== expectedId) {
      throw new ServoError(
        `ID mismatch: expected ${expectedId}, got ${response.id}`,
        ErrorCode.INVALID_RESPONSE
      );
    }

    // Check for errors
    this.packetHandler.checkError(response);

    return response;
  }

  async ping(id: number): Promise<PingResult> {
    const pingPkt = this.packetHandler.createPingPacket(id);
    await this.sendAndReceive(pingPkt, id);

    let modelNumber = 0;
    let firmwareVersion = 0;
    try {
      const modelData = await this.readData(id, 3, 2);          // Model Number
      modelNumber = makeWord(modelData[0], modelData[1]);
      const fwData = await this.readData(id, 2, 1);
      firmwareVersion = fwData[0];
    } catch (_) { /* ignore */ }

    return { id, modelNumber, firmwareVersion };
  }

  async readData(id: number, address: number, length: number): Promise<Uint8Array> {
    const packet = this.packetHandler.createReadPacket(id, address, length);
    const response = await this.sendAndReceive(packet, id);

    if (response.parameters.length < length) {
      throw new ServoError(
        `Invalid read response: expected ${length} bytes, got ${response.parameters.length}`,
        ErrorCode.INVALID_RESPONSE,
        id
      );
    }

    return response.parameters.slice(0, length);
  }

  async writeData(id: number, address: number, data: Uint8Array): Promise<void> {
    const packet = this.packetHandler.createWritePacket(id, address, data);
    await this.sendAndReceive(packet, id);
    
    // Add small delay after write to ensure servo processes the command
    await new Promise(resolve => setTimeout(resolve, LATENCY_TIMER));
  }

  async readByte(id: number, address: number): Promise<number> {
    const data = await this.readData(id, address, 1);
    return data[0];
  }

  async writeByte(id: number, address: number, value: number): Promise<void> {
    const data = new Uint8Array([value & 0xFF]);
    await this.writeData(id, address, data);
  }

  async readWord(id: number, address: number): Promise<number> {
    const data = await this.readData(id, address, 2);
    return makeWord(data[0], data[1]);
  }

  async writeWord(id: number, address: number, value: number): Promise<void> {
    const data = new Uint8Array([getLowByte(value), getHighByte(value)]);
    await this.writeData(id, address, data);
  }

  async readPosition(id: number): Promise<number> {
    const entry = getControlTableEntry(this.model, 'Present_Position');
    if (!entry) throw new ServoError('Present_Position not found in control table', ErrorCode.INVALID_PARAMETER);
    return await this.readWord(id, entry.address);
  }

  async writePosition(id: number, position: number, speed?: number): Promise<void> {
    // Set speed if provided
    if (speed !== undefined) {
      const speedEntry = getControlTableEntry(this.model, 'Goal_Speed');
      if (!speedEntry) throw new ServoError('Goal_Speed not found in control table', ErrorCode.INVALID_PARAMETER);
      await this.writeWord(id, speedEntry.address, speed);
    }

    // Set position
    const posEntry = getControlTableEntry(this.model, 'Goal_Position');
    if (!posEntry) throw new ServoError('Goal_Position not found in control table', ErrorCode.INVALID_PARAMETER);
    await this.writeWord(id, posEntry.address, position);
  }

  async setTorque(id: number, enabled: boolean): Promise<void> {
    const entry = getControlTableEntry(this.model, 'Torque_Enable');
    if (!entry) throw new ServoError('Torque_Enable not found in control table', ErrorCode.INVALID_PARAMETER);
    await this.writeByte(
      id, 
      entry.address, 
      enabled ? TORQUE_ENABLE : TORQUE_DISABLE
    );
  }

  async readStatus(id: number): Promise<ServoStatus> {
    // Get addresses from control table
    const posEntry = getControlTableEntry(this.model, 'Present_Position');
    const voltEntry = getControlTableEntry(this.model, 'Present_Voltage');
    const movingEntry = getControlTableEntry(this.model, 'Moving');
    
    if (!posEntry || !voltEntry || !movingEntry) {
      throw new ServoError('Required status entries not found in control table', ErrorCode.INVALID_PARAMETER);
    }

    // Read all status data in one go for efficiency
    const data = await this.readData(
      id,
      posEntry.address,
      8 // Position(2) + Speed(2) + Load(2) + Voltage(1) + Temperature(1)
    );

    return {
      position: makeWord(data[0], data[1]),
      speed: makeWord(data[2], data[3]),
      load: makeWord(data[4], data[5]),
      voltage: data[6] / 10.0, // Convert to volts
      temperature: data[7],
      moving: (await this.readByte(id, movingEntry.address)) === 1,
      errorStatus: 0 // Will be set from last response error
    };
  }

  async setID(id: number, newId: number): Promise<void> {
    if (newId < 0 || newId > 253) {
      throw new ServoError(
        'Invalid ID: must be between 0 and 253',
        ErrorCode.INVALID_PARAMETER
      );
    }
    const entry = getControlTableEntry(this.model, 'ID');
    if (!entry) throw new ServoError('ID not found in control table', ErrorCode.INVALID_PARAMETER);
    await this.writeByte(id, entry.address, newId);
  }

  async setBaudRate(id: number, baudRate: number): Promise<void> {
    // Feetech は固定テーブル方式 (0‑7) を採用
    let value: number;
    try {
      value = getBaudRateValue(baudRate);   // helpers で 0‑7 を取得
    } catch (_) {
      throw new ServoError(
        `Unsupported baud rate: ${baudRate}`,
        ErrorCode.INVALID_PARAMETER
      );
    }
     
    const entry = getControlTableEntry(this.model, 'Baud_Rate');
    if (!entry) throw new ServoError('Baud_Rate not found in control table', ErrorCode.INVALID_PARAMETER);
    await this.writeByte(id, entry.address, value);
    // 書き込み後、サーボが再設定を反映するまで少し待つ
    await new Promise(r => setTimeout(r, LATENCY_TIMER));
  }

  async factoryReset(id: number): Promise<void> {
    const packet = this.packetHandler.createPacket(id, Instruction.FACTORY_RESET);
    await this.sendAndReceive(packet, id);
    
    // Factory reset takes time
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async reboot(id: number): Promise<void> {
    const packet = this.packetHandler.createPacket(id, Instruction.REBOOT);
    await this.sendAndReceive(packet, id);
    
    // Reboot takes time
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}