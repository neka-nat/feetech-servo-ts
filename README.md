# Feetech Servo SDK for TypeScript

A TypeScript SDK for controlling Feetech servo motors using Web Serial API. This library provides a modern, type-safe interface for interacting with STS, SMS, and SCS series servo motors in web browsers.

## Features

- 🌐 **Web Serial API Integration** - Direct browser-to-servo communication
- 📦 **TypeScript Support** - Full type definitions and IntelliSense
- 🔄 **Synchronous Operations** - Control multiple servos simultaneously
- 🛡️ **Error Handling** - Comprehensive error detection and reporting
- 🚀 **Modern API** - Promise-based async/await interface
- 📱 **Cross-Platform** - Works on any browser supporting Web Serial API

## Browser Compatibility

This SDK requires Web Serial API support:
- Chrome 89+
- Edge 89+
- Opera 75+

## Installation

```bash
npm install feetech-servo-ts
```

## Quick Start

```typescript
import { FeetechServo } from 'feetech-servo-ts';

// Create servo instance
const servo = new FeetechServo({ baudRate: 1000000 });

// Connect to servo
await servo.connect();

// Ping servo
const result = await servo.ping(1);
console.log(`Found servo: ID=${result.id}, Model=${result.modelNumber}`);

// Enable torque
await servo.enableTorque(1);

// Move servo to center position
await servo.writePosition(1, 512, 200); // position: 512, speed: 200

// Read current position
const position = await servo.readPosition(1);
console.log(`Current position: ${position}`);

// Disconnect
await servo.disconnect();
```

## API Documentation

### Connection Management

```typescript
// Connect to servo
await servo.connect();

// Check connection status
const isConnected = servo.getConnectionStatus();

// Disconnect
await servo.disconnect();
```

### Basic Operations

```typescript
// Ping servo
const pingResult = await servo.ping(servoId);

// Scan for servos
const foundServos = await servo.scan(0, 20); // Scan IDs 0-20

// Read/Write position
const position = await servo.readPosition(servoId);
await servo.writePosition(servoId, targetPosition, speed);

// Position control in degrees
await servo.setPositionInDegrees(servoId, 150); // 0-300 degrees
const degrees = await servo.getPositionInDegrees(servoId);

// Torque control
await servo.enableTorque(servoId);
await servo.disableTorque(servoId);

// Read complete status
const status = await servo.readStatus(servoId);
```

### Synchronous Control

```typescript
// Sync write positions
await servo.syncWritePosition([
  { id: 1, position: 512 },
  { id: 2, position: 768 },
  { id: 3, position: 256 }
]);

// Sync read positions
const positions = await servo.syncReadPosition([1, 2, 3]);
positions.forEach((pos, id) => {
  console.log(`Servo ${id}: ${pos}`);
});
```

### Advanced Operations

```typescript
// Change servo ID
await servo.setID(currentId, newId);

// Set baud rate
await servo.setBaudRate(servoId, 1000000);

// Factory reset
await servo.factoryReset(servoId);

// Reboot servo
await servo.reboot(servoId);

// Direct register access
const value = await servo.readByte(servoId, address);
await servo.writeByte(servoId, address, value);
```

### Group Operations

```typescript
// Create sync write group
const syncWrite = servo.createSyncWrite(ControlTable.GOAL_POSITION_L, 2);
syncWrite.addParam(1, new Uint8Array([0x00, 0x02])); // Position 512
syncWrite.addParam(2, new Uint8Array([0x00, 0x03])); // Position 768
await syncWrite.txPacket();

// Create sync read group
const syncRead = servo.createSyncRead(ControlTable.PRESENT_POSITION_L, 2);
syncRead.addParam(1);
syncRead.addParam(2);
await syncRead.txRxPacket();

const data1 = syncRead.getData(1);
const data2 = syncRead.getData(2);
```

## Helper Functions

```typescript
import { helpers } from 'feetech-servo-ts';

// Check Web Serial support
if (helpers.isWebSerialSupported()) {
  // Web Serial is available
}

// Convert between degrees and position values
const position = helpers.degreesToPosition(150); // 150° → position value
const degrees = helpers.positionToDegrees(512);  // position → degrees

// Convert RPM to speed value
const speed = helpers.rpmToSpeed(60); // 60 RPM → speed value
const rpm = helpers.speedToRpm(512);  // speed → RPM

// Clamp values to valid ranges
const safePosition = helpers.clampPosition(2000); // Returns 1023
const safeSpeed = helpers.clampSpeed(-100);       // Returns 0
```

## Error Handling

```typescript
import { ServoError, ErrorCode } from 'feetech-servo-ts';

try {
  await servo.connect();
} catch (error) {
  if (error instanceof ServoError) {
    switch (error.code) {
      case ErrorCode.CONNECTION_FAILED:
        console.error('Failed to connect to servo');
        break;
      case ErrorCode.TIMEOUT:
        console.error('Operation timed out');
        break;
      case ErrorCode.CHECKSUM_ERROR:
        console.error('Communication error');
        break;
    }
  }
}
```

## Examples

Check the `examples` directory for complete working examples:

1. **Basic Control** - Simple position and torque control
2. **Servo Scanner** - Scan and identify connected servos
3. **Sync Control** - Control multiple servos simultaneously
4. **Advanced Settings** - Change IDs, baud rates, and factory reset

To run examples:

```bash
cd examples
npm install
npm run dev
```

Then open http://localhost:3000 in your browser.

## Development

### Setup

```bash
# Install dependencies
npm install

# Install example dependencies
cd examples && npm install && cd ..
```

### Development Workflow

When developing the SDK and testing with examples:

1. **Start SDK build in watch mode** (in the root directory):
   ```bash
   npm run dev
   ```
   This watches for changes in `src/` and automatically rebuilds to `dist/`

2. **In a separate terminal, run the example** (in the examples directory):
   ```bash
   cd examples && npm run dev
   ```

3. **Both processes must run simultaneously** for live updates:
   - SDK changes in `src/` → automatically built to `dist/`
   - Example imports from `dist/` → sees updates immediately

### Alternative: One-time build
```bash
# Build once and run example
npm run build && cd examples && npm run dev
```

### Other Commands

```bash
# Run tests
npm run test

# Lint code
npm run lint

# Format code
npm run format

# Build for production
npm run build
```

## Protocol Information

This SDK implements the Feetech servo protocol, compatible with:
- STS Series (Serial Bus Servo)
- SMS Series (Serial Bus Servo)
- SCS Series (Serial Bus Servo)

Default communication parameters:
- Baud Rate: 1,000,000 bps
- Data Bits: 8
- Stop Bits: 1
- Parity: None

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and feature requests, please use the GitHub issues page.