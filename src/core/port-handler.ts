import { SerialOptions, ServoError, ErrorCode } from '../types';
import { DEFAULT_BAUDRATE, DEFAULT_TIMEOUT } from './constants';

export class WebSerialPortHandler {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private readBuffer: Uint8Array = new Uint8Array(0);
  private isOpen = false;

  constructor(
    private options: SerialOptions = { baudRate: DEFAULT_BAUDRATE },
    private timeout: number = DEFAULT_TIMEOUT
  ) {}

  async connect(): Promise<void> {
    try {
      if (!('serial' in navigator)) {
        throw new ServoError(
          'Web Serial API is not supported in this browser',
          ErrorCode.CONNECTION_FAILED
        );
      }

      this.port = await navigator.serial.requestPort();
      await this.port.open(this.options);

      if (!this.port.readable || !this.port.writable) {
        throw new ServoError(
          'Port is not readable or writable',
          ErrorCode.CONNECTION_FAILED
        );
      }

      this.reader = this.port.readable.getReader();
      this.writer = this.port.writable.getWriter();
      this.isOpen = true;

      // Start background reading
      this.startReading();
    } catch (error) {
      if (error instanceof ServoError) {
        throw error;
      }
      throw new ServoError(
        `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.CONNECTION_FAILED
      );
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.isOpen = false;

      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }

      if (this.writer) {
        await this.writer.close();
        this.writer = null;
      }

      if (this.port) {
        await this.port.close();
        this.port = null;
      }

      this.readBuffer = new Uint8Array(0);
    } catch (error) {
      throw new ServoError(
        `Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.CONNECTION_LOST
      );
    }
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.writer || !this.isOpen) {
      throw new ServoError('Port is not connected', ErrorCode.CONNECTION_LOST);
    }

    try {
      await this.writer.write(data);
    } catch (error) {
      throw new ServoError(
        `Write error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.WRITE_ERROR
      );
    }
  }

  async read(length: number, timeoutMs?: number): Promise<Uint8Array> {
    if (!this.reader || !this.isOpen) {
      throw new ServoError('Port is not connected', ErrorCode.CONNECTION_LOST);
    }

    const timeout = timeoutMs ?? this.timeout;
    const startTime = Date.now();

    while (this.readBuffer.length < length) {
      if (Date.now() - startTime > timeout) {
        throw new ServoError(
          `Read timeout: expected ${length} bytes, got ${this.readBuffer.length}`,
          ErrorCode.TIMEOUT
        );
      }

      await new Promise(resolve => setTimeout(resolve, 1));
    }

    const result = this.readBuffer.slice(0, length);
    this.readBuffer = this.readBuffer.slice(length);
    return result;
  }

  async flush(): Promise<void> {
    this.readBuffer = new Uint8Array(0);
  }

  isConnected(): boolean {
    return this.isOpen && this.port !== null;
  }

  private async startReading(): Promise<void> {
    if (!this.reader) return;

    try {
      while (this.isOpen) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          this.appendToBuffer(value);
        }
      }
    } catch (error) {
      if (this.isOpen) {
        console.error('Read error:', error);
      }
    }
  }

  private appendToBuffer(data: Uint8Array): void {
    const newBuffer = new Uint8Array(this.readBuffer.length + data.length);
    newBuffer.set(this.readBuffer);
    newBuffer.set(data, this.readBuffer.length);
    this.readBuffer = newBuffer;
  }

  async waitForData(predicate: (buffer: Uint8Array) => boolean, timeoutMs?: number): Promise<void> {
    const timeout = timeoutMs ?? this.timeout;
    const startTime = Date.now();

    while (!predicate(this.readBuffer)) {
      if (Date.now() - startTime > timeout) {
        throw new ServoError('Wait for data timeout', ErrorCode.TIMEOUT);
      }
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }

  getBufferLength(): number {
    return this.readBuffer.length;
  }

  peekBuffer(length: number): Uint8Array {
    return this.readBuffer.slice(0, Math.min(length, this.readBuffer.length));
  }
}