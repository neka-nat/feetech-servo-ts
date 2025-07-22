import { FeetechServo, FeetechServoConfig, helpers, ServoError, ErrorCode, MotorModel } from '@feetech/servo-sdk';

// Global servo instance
let servo: FeetechServo | null = null;

// Console logging
function log(message: string, type: 'info' | 'error' | 'success' = 'info') {
  const console = document.getElementById('console');
  if (!console) return;
  
  const line = document.createElement('div');
  line.className = `console-line ${type}`;
  const timestamp = new Date().toLocaleTimeString();
  line.textContent = `[${timestamp}] ${message}`;
  console.appendChild(line);
  console.scrollTop = console.scrollHeight;
}

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.getAttribute('data-tab');
    if (!tabName) return;

    // Update active tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Show corresponding panel
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.add('hidden');
    });
    document.getElementById(`${tabName}-tab`)?.classList.remove('hidden');
  });
});

// Connection management
const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement;
const disconnectBtn = document.getElementById('disconnectBtn') as HTMLButtonElement;
const connectionStatus = document.getElementById('connectionStatus') as HTMLElement;

connectBtn.addEventListener('click', async () => {
  try {
    if (!helpers.isWebSerialSupported()) {
      log('Web Serial API is not supported in this browser', 'error');
      return;
    }

    log('Requesting serial port...');
    const config: FeetechServoConfig = {
      port: { baudRate: 1000000 },
      defaultModel: MotorModel.SCS_SERIES,
      motors: {
        'servo1': { id: 1, model: MotorModel.SCS_SERIES },
        'servo2': { id: 2, model: MotorModel.SCS_SERIES },
        'servo3': { id: 3, model: MotorModel.SCS_SERIES },
      }
    };
    servo = new FeetechServo(config);
    await servo.connect();

    log('Connected successfully!', 'success');
    connectionStatus.textContent = 'Connected';
    connectionStatus.className = 'status connected';

    const model = servo?.getMotorModel('servo1') ?? 'scs_series';
    const maxPos = helpers.getModelMaxPosition(model);

    // 個別制御
    positionSlider.max = String(maxPos);
    positionInput.max  = String(maxPos);

    // Sync 制御
    syncPositionSlider.max = String(maxPos);
    syncPositionInput.max  = String(maxPos);

    // ラベルも書き換え
    const posLabel  = document.querySelector('label[for="positionSlider"]');
    if (posLabel)  posLabel.textContent  = `Position (0‑${maxPos})`;
    const syncLabel = document.querySelector('label[for="syncPosition"]');
    if (syncLabel) syncLabel.textContent = `Target Position (0‑${maxPos})`;

    // Update button states
    connectBtn.disabled = true;
    disconnectBtn.disabled = false;
    enableControls(true);
  } catch (error) {
    if (error instanceof ServoError) {
      log(`Connection failed: ${error.message}`, 'error');
    } else {
      log('Connection cancelled or failed', 'error');
    }
  }
});

disconnectBtn.addEventListener('click', async () => {
  if (!servo) return;

  try {
    await servo.disconnect();
    servo = null;

    log('Disconnected', 'info');
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.className = 'status disconnected';

    // Update button states
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
    enableControls(false);
  } catch (error) {
    log(`Disconnect error: ${error}`, 'error');
  }
});

function enableControls(enabled: boolean) {
  const buttons = document.querySelectorAll('button:not(#connectBtn):not(#disconnectBtn):not(.tab)');
  buttons.forEach(btn => {
    (btn as HTMLButtonElement).disabled = !enabled;
  });
}

// Scan functionality
const scanBtn = document.getElementById('scanBtn') as HTMLButtonElement;
const servoList = document.getElementById('servoList') as HTMLElement;

scanBtn.addEventListener('click', async () => {
  if (!servo) return;

  log('Scanning for servos...');
  servoList.innerHTML = '<p>Scanning...</p>';

  try {
    const found = await servo.scan(0, 20); // Scan first 20 IDs for faster demo

    if (found.length === 0) {
      servoList.innerHTML = '<p>No servos found</p>';
      log('No servos found', 'error');
    } else {
      log(`Found ${found.length} servo(s)`, 'success');
      servoList.innerHTML = '';

      for (const result of found) {
        const item = document.createElement('div');
        item.className = 'servo-item';
        item.innerHTML = `
          <h4>Servo ID: ${result.id}</h4>
          <div class="servo-info">
            <div class="info-item">
              <span class="info-label">Model:</span> ${result.modelNumber}
            </div>
            <div class="info-item">
              <span class="info-label">Firmware:</span> v${result.firmwareVersion}
            </div>
          </div>
        `;
        servoList.appendChild(item);
      }
    }
  } catch (error) {
    log(`Scan error: ${error}`, 'error');
    servoList.innerHTML = '<p>Scan failed</p>';
  }
});

// Individual control
const positionSlider = document.getElementById('positionSlider') as HTMLInputElement;
const positionInput = document.getElementById('positionInput') as HTMLInputElement;
const speedSlider = document.getElementById('speedSlider') as HTMLInputElement;
const speedInput = document.getElementById('speedInput') as HTMLInputElement;

// Sync slider and input
positionSlider.addEventListener('input', () => {
  positionInput.value = positionSlider.value;
});

positionInput.addEventListener('input', () => {
  positionSlider.value = positionInput.value;
});

speedSlider.addEventListener('input', () => {
  speedInput.value = speedSlider.value;
});

speedInput.addEventListener('input', () => {
  speedSlider.value = speedInput.value;
});

// Torque control
const enableTorqueBtn = document.getElementById('enableTorqueBtn') as HTMLButtonElement;
const disableTorqueBtn = document.getElementById('disableTorqueBtn') as HTMLButtonElement;

enableTorqueBtn.addEventListener('click', async () => {
  if (!servo) return;

  const id = parseInt((document.getElementById('servoId') as HTMLInputElement).value);
  try {
    await servo.enableTorque(id);
    log(`Torque enabled for servo ${id}`, 'success');
  } catch (error) {
    log(`Failed to enable torque: ${error}`, 'error');
  }
});

disableTorqueBtn.addEventListener('click', async () => {
  if (!servo) return;

  const id = parseInt((document.getElementById('servoId') as HTMLInputElement).value);
  try {
    await servo.disableTorque(id);
    log(`Torque disabled for servo ${id}`, 'success');
  } catch (error) {
    log(`Failed to disable torque: ${error}`, 'error');
  }
});

// Move servo
const moveBtn = document.getElementById('moveBtn') as HTMLButtonElement;

moveBtn.addEventListener('click', async () => {
  if (!servo) return;

  const id = parseInt((document.getElementById('servoId') as HTMLInputElement).value);
  const position = parseInt(positionInput.value);
  const speed = parseInt(speedInput.value);

  try {
    await servo.writePosition(id, position, speed);
    log(`Moving servo ${id} to position ${position} at speed ${speed}`, 'success');
  } catch (error) {
    log(`Failed to move servo: ${error}`, 'error');
  }
});

// Read status
const readStatusBtn = document.getElementById('readStatusBtn') as HTMLButtonElement;
const statusDisplay = document.getElementById('statusDisplay') as HTMLElement;
const statusInfo = document.getElementById('statusInfo') as HTMLElement;

readStatusBtn.addEventListener('click', async () => {
  if (!servo) return;

  const id = parseInt((document.getElementById('servoId') as HTMLInputElement).value);

  try {
    const status = await servo.readStatus(id);
    statusDisplay.style.display = 'block';
    
    statusInfo.innerHTML = `
      <div class="info-item">
        <span class="info-label">Position:</span> ${status.position}
      </div>
      <div class="info-item">
        <span class="info-label">Speed:</span> ${status.speed}
      </div>
      <div class="info-item">
        <span class="info-label">Load:</span> ${status.load}
      </div>
      <div class="info-item">
        <span class="info-label">Voltage:</span> ${status.voltage.toFixed(1)}V
      </div>
      <div class="info-item">
        <span class="info-label">Temperature:</span> ${status.temperature}°C
      </div>
      <div class="info-item">
        <span class="info-label">Moving:</span> ${status.moving ? 'Yes' : 'No'}
      </div>
    `;

    log(`Status read for servo ${id}`, 'success');
  } catch (error) {
    log(`Failed to read status: ${error}`, 'error');
    statusDisplay.style.display = 'none';
  }
});

// Sync control
const syncPositionSlider = document.getElementById('syncPositionSlider') as HTMLInputElement;
const syncPositionInput = document.getElementById('syncPositionInput') as HTMLInputElement;

syncPositionSlider.addEventListener('input', () => {
  syncPositionInput.value = syncPositionSlider.value;
});

syncPositionInput.addEventListener('input', () => {
  syncPositionSlider.value = syncPositionInput.value;
});

const syncMoveBtn = document.getElementById('syncMoveBtn') as HTMLButtonElement;
const syncReadBtn = document.getElementById('syncReadBtn') as HTMLButtonElement;
const syncResults = document.getElementById('syncResults') as HTMLElement;

syncMoveBtn.addEventListener('click', async () => {
  if (!servo) return;

  const idsText = (document.getElementById('syncIds') as HTMLInputElement).value;
  const ids = idsText.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
  const position = parseInt(syncPositionInput.value);

  if (ids.length === 0) {
    log('No valid servo IDs provided', 'error');
    return;
  }

  try {
    const positions = ids.map(id => ({ id, position }));
    await servo.syncWritePosition(positions);
    log(`Moved ${ids.length} servos to position ${position}`, 'success');
  } catch (error) {
    log(`Sync move failed: ${error}`, 'error');
  }
});

syncReadBtn.addEventListener('click', async () => {
  if (!servo) return;

  const idsText = (document.getElementById('syncIds') as HTMLInputElement).value;
  const ids = idsText.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

  if (ids.length === 0) {
    log('No valid servo IDs provided', 'error');
    return;
  }

  try {
    const positions = await servo.syncReadPosition(ids);
    syncResults.innerHTML = '';
    
    for (const [id, position] of positions) {
      const item = document.createElement('div');
      item.className = 'servo-item';
      item.innerHTML = `
        <strong>Servo ${id}:</strong> Position = ${position}
      `;
      syncResults.appendChild(item);
    }

    log(`Read positions from ${positions.size} servos`, 'success');
  } catch (error) {
    log(`Sync read failed: ${error}`, 'error');
    syncResults.innerHTML = '';
  }
});

// Advanced settings
const changeIdBtn = document.getElementById('changeIdBtn') as HTMLButtonElement;
const factoryResetBtn = document.getElementById('factoryResetBtn') as HTMLButtonElement;

changeIdBtn.addEventListener('click', async () => {
  if (!servo) return;

  const currentId = parseInt((document.getElementById('currentId') as HTMLInputElement).value);
  const newId = parseInt((document.getElementById('newId') as HTMLInputElement).value);

  if (isNaN(currentId) || isNaN(newId)) {
    log('Invalid ID values', 'error');
    return;
  }

  if (confirm(`Change servo ID from ${currentId} to ${newId}?`)) {
    try {
      await servo.setID(currentId, newId);
      log(`Changed servo ID from ${currentId} to ${newId}`, 'success');
    } catch (error) {
      log(`Failed to change ID: ${error}`, 'error');
    }
  }
});

factoryResetBtn.addEventListener('click', async () => {
  if (!servo) return;

  const id = parseInt((document.getElementById('resetId') as HTMLInputElement).value);

  if (isNaN(id)) {
    log('Invalid ID value', 'error');
    return;
  }

  if (confirm(`Factory reset servo ${id}? This will reset all settings to defaults.`)) {
    try {
      await servo.factoryReset(id);
      log(`Factory reset servo ${id}`, 'success');
    } catch (error) {
      log(`Failed to factory reset: ${error}`, 'error');
    }
  }
});

// Initialize
log('Feetech Servo SDK initialized. Click "Connect to Servo" to begin.');