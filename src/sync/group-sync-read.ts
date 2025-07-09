import { WebSerialPortHandler } from '../core/port-handler';
import { PacketHandler } from '../core/packet-handler';
import { ServoError, ErrorCode, ResponsePacket } from '../types';
import { DEFAULT_TIMEOUT } from '../core/constants';

export class GroupSyncRead {
  private packetHandler: PacketHandler;
  private idList: Set<number> = new Set();
  private dataMap: Map<number, Uint8Array> = new Map();

  constructor(
    private portHandler: WebSerialPortHandler,
    private address: number,
    private dataLength: number,
    private timeout: number = DEFAULT_TIMEOUT
  ) {
    this.packetHandler = new PacketHandler();
  }

  addParam(id: number): void {
    this.idList.add(id);
  }

  removeParam(id: number): void {
    this.idList.delete(id);
    this.dataMap.delete(id);
  }

  clearParam(): void {
    this.idList.clear();
    this.dataMap.clear();
  }

  async txRxPacket(): Promise<void> {
    if (this.idList.size === 0) {
      throw new ServoError(
        'No parameters to read',
        ErrorCode.INVALID_PARAMETER
      );
    }

    // Clear previous data
    this.dataMap.clear();

    // Convert set to array
    const ids = Array.from(this.idList);

    // Create sync read packet
    const packet = this.packetHandler.createSyncReadPacket(
      this.address,
      this.dataLength,
      ids
    );

    // Clear any pending data
    await this.portHandler.flush();

    // Send packet
    await this.portHandler.write(packet);

    // Read responses for each ID
    for (const id of ids) {
      try {
        const response = await this.readResponse(id);
        if (response.parameters.length >= this.dataLength) {
          this.dataMap.set(id, response.parameters.slice(0, this.dataLength));
        }
      } catch (error) {
        console.error(`Failed to read from servo ${id}:`, error);
        // Continue with other servos
      }
    }
  }

  private async readResponse(expectedId: number): Promise<ResponsePacket> {
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

    const payload = await this.portHandler.read(pktLen - 4);
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

  isAvailable(id: number, _addr?: number, _len?: number): boolean {
    const data = this.dataMap.get(id);
    return !!data && data.length >= this.dataLength;
  }

  getData(id: number, _addr?: number, _len?: number): Uint8Array | undefined {
    const data = this.dataMap.get(id);
    return data ? new Uint8Array(data) : undefined;
  }

  getAddress(): number {
    return this.address;
  }

  getDataLength(): number {
    return this.dataLength;
  }

  getParamCount(): number {
    return this.idList.size;
  }

  hasParam(id: number): boolean {
    return this.idList.has(id);
  }
}