import { WebSerialPortHandler } from '../core/port-handler';
import { PacketHandler } from '../core/packet-handler';
import { ServoError, ErrorCode } from '../types';
import { LATENCY_TIMER } from '../core/constants';

export interface SyncWriteItem {
  id: number;
  data: Uint8Array;
}

export class GroupSyncWrite {
  private packetHandler: PacketHandler;
  private dataMap: Map<number, Uint8Array> = new Map();

  constructor(
    private portHandler: WebSerialPortHandler,
    private address: number,
    private dataLength: number
  ) {
    this.packetHandler = new PacketHandler();
  }

  addParam(id: number, data: Uint8Array): void {
    if (data.length !== this.dataLength) {
      throw new ServoError(
        `Data length mismatch: expected ${this.dataLength}, got ${data.length}`,
        ErrorCode.INVALID_PARAMETER,
        id
      );
    }

    this.dataMap.set(id, new Uint8Array(data));
  }

  removeParam(id: number): void {
    this.dataMap.delete(id);
  }

  clearParam(): void {
    this.dataMap.clear();
  }

  async txPacket(): Promise<void> {
    if (this.dataMap.size === 0) {
      throw new ServoError(
        'No parameters to send',
        ErrorCode.INVALID_PARAMETER
      );
    }

    // Convert map to array for packet creation
    const items: Array<{id: number, values: Uint8Array}> = [];
    for (const [id, data] of this.dataMap) {
      items.push({ id, values: data });
    }

    // Create sync write packet
    const packet = this.packetHandler.createSyncWritePacket(
      this.address,
      this.dataLength,
      items
    );

    // Clear any pending data
    await this.portHandler.flush();

    // Send packet (no response expected for sync write)
    await this.portHandler.write(packet);

    // Add small delay to ensure servos process the command
    await new Promise(resolve => setTimeout(resolve, LATENCY_TIMER));
  }

  getAddress(): number {
    return this.address;
  }

  getDataLength(): number {
    return this.dataLength;
  }

  getParamCount(): number {
    return this.dataMap.size;
  }

  hasParam(id: number): boolean {
    return this.dataMap.has(id);
  }

  getParam(id: number): Uint8Array | undefined {
    const data = this.dataMap.get(id);
    return data ? new Uint8Array(data) : undefined;
  }
}