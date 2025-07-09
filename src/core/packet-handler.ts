import { ResponsePacket, Instruction, ServoError, ErrorCode, ErrorBit } from '../types';
import { 
  HEADER, 
  HEADER_LENGTH, 
  ID_LENGTH, 
  LENGTH_LENGTH, 
  MIN_PACKET_LENGTH,
  BROADCAST_ID
} from './constants';

export class PacketHandler {
  createPacket(id: number, instruction: Instruction, parameters?: Uint8Array): Uint8Array {
    const paramLength = parameters?.length ?? 0;
    const packetLength = MIN_PACKET_LENGTH + paramLength;
    const packet = new Uint8Array(packetLength);

    // Header
    packet[0] = HEADER[0];
    packet[1] = HEADER[1];

    // ID
    packet[2] = id;

    // Length (instruction + parameters + checksum)
    packet[3] = paramLength + 2;

    // Instruction
    packet[4] = instruction;

    // Parameters
    if (parameters && paramLength > 0) {
      packet.set(parameters, 5);
    }

    // Checksum
    const checksum = this.calculateChecksum(packet.slice(2, packetLength - 1));
    packet[packetLength - 1] = checksum;

    return packet;
  }

  parsePacket(data: Uint8Array): ResponsePacket {
    if (data.length < MIN_PACKET_LENGTH) {
      throw new ServoError(
        `Packet too short: ${data.length} bytes`,
        ErrorCode.INVALID_RESPONSE
      );
    }

    // Verify header
    if (data[0] !== HEADER[0] || data[1] !== HEADER[1]) {
      throw new ServoError(
        'Invalid packet header',
        ErrorCode.INVALID_RESPONSE
      );
    }

    const id = data[2];
    const length = data[3];
    const error = data[4];

    const expectedPacketLength = HEADER_LENGTH + ID_LENGTH + LENGTH_LENGTH + length;
    if (data.length < expectedPacketLength) {
      throw new ServoError(
        `Incomplete packet: expected ${expectedPacketLength} bytes, got ${data.length}`,
        ErrorCode.INVALID_RESPONSE
      );
    }

    // Extract parameters
    const paramLength = length - 2; // Subtract error and checksum
    const parameters = paramLength > 0 
      ? data.slice(5, 5 + paramLength)
      : new Uint8Array(0);

    // Verify checksum
    const receivedChecksum = data[expectedPacketLength - 1];
    const calculatedChecksum = this.calculateChecksum(
      data.slice(2, expectedPacketLength - 1)
    );

    if (receivedChecksum !== calculatedChecksum) {
      throw new ServoError(
        `Checksum mismatch: expected ${calculatedChecksum}, got ${receivedChecksum}`,
        ErrorCode.CHECKSUM_ERROR,
        id
      );
    }

    return {
      id,
      instruction: 0, // Response packets don't have instruction
      parameters,
      length,
      error,
      checksum: receivedChecksum
    };
  }

  calculateChecksum(data: Uint8Array): number {
    let sum = 0;
    for (const byte of data) {
      sum += byte;
    }
    return (~sum) & 0xFF;
  }

  createPingPacket(id: number): Uint8Array {
    return this.createPacket(id, Instruction.PING);
  }

  createReadPacket(id: number, address: number, length: number): Uint8Array {
    const params = new Uint8Array([address, length]);
    return this.createPacket(id, Instruction.READ, params);
  }

  createWritePacket(id: number, address: number, data: Uint8Array): Uint8Array {
    const params = new Uint8Array(1 + data.length);
    params[0] = address;
    params.set(data, 1);
    return this.createPacket(id, Instruction.WRITE, params);
  }

  createSyncWritePacket(address: number, length: number, data: Array<{id: number, values: Uint8Array}>): Uint8Array {
    let totalDataLength = 0;
    for (const item of data) {
      totalDataLength += 1 + item.values.length; // ID + values
    }

    const params = new Uint8Array(2 + totalDataLength);
    params[0] = address;
    params[1] = length;

    let offset = 2;
    for (const item of data) {
      params[offset] = item.id;
      params.set(item.values, offset + 1);
      offset += 1 + item.values.length;
    }

    return this.createPacket(BROADCAST_ID, Instruction.SYNC_WRITE, params);
  }

  createSyncReadPacket(address: number, length: number, ids: number[]): Uint8Array {
    const params = new Uint8Array(2 + ids.length);
    params[0] = address;
    params[1] = length;
    params.set(ids, 2);
    return this.createPacket(BROADCAST_ID, Instruction.SYNC_READ, params);
  }

  checkError(packet: ResponsePacket): void {
    if (packet.error === 0) return;

    const errors: string[] = [];
    
    if (packet.error & ErrorBit.VOLTAGE) {
      errors.push('Input voltage error');
    }
    if (packet.error & ErrorBit.ANGLE) {
      errors.push('Angle limit error');
    }
    if (packet.error & ErrorBit.OVERHEAT) {
      errors.push('Overheat error');
    }
    if (packet.error & ErrorBit.RANGE) {
      errors.push('Out of range error');
    }
    if (packet.error & ErrorBit.CHECKSUM) {
      errors.push('Checksum error');
    }
    if (packet.error & ErrorBit.OVERLOAD) {
      errors.push('Overload error');
    }
    if (packet.error & ErrorBit.INSTRUCTION) {
      errors.push('Invalid instruction error');
    }

    if (errors.length > 0) {
      throw new ServoError(
        `Servo error (0x${packet.error.toString(16)}): ${errors.join(', ')}`,
        ErrorCode.HARDWARE_ERROR,
        packet.id
      );
    }
  }

  isValidPacketStart(data: Uint8Array): boolean {
    return data.length >= 2 && data[0] === HEADER[0] && data[1] === HEADER[1];
  }

  getPacketLength(data: Uint8Array): number | null {
    if (data.length < 4) return null;
    return HEADER_LENGTH + ID_LENGTH + LENGTH_LENGTH + data[3];
  }
}