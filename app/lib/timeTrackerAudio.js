let preparedAudio = null;
let preparedBuffer = null;
let sharedAudioContext = null;
let audioUnlocked = false;

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContextClass();
  }

  return sharedAudioContext;
}

async function unlockAudioContext() {
  const audioContext = getAudioContext();
  if (!audioContext) {
    return false;
  }

  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  return audioContext.state === 'running';
}

async function decodeAlertBuffer() {
  const audioContext = getAudioContext();
  if (!audioContext) {
    return null;
  }

  if (preparedBuffer) {
    return preparedBuffer;
  }

  const response = await fetch('/sounds/timer-alert.mp3');
  if (!response.ok) {
    throw new Error(`Failed to fetch alert sound: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  preparedBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  return preparedBuffer;
}

async function playFallbackBeep() {
  const audioContext = getAudioContext();
  if (!audioContext) {
    return false;
  }

  try {
    await unlockAudioContext();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(660, audioContext.currentTime + 0.18);

    gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.35);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.35);

    await new Promise((resolve) => {
      oscillator.onended = resolve;
    });

    return true;
  } catch (error) {
    console.error('Failed to play fallback time tracker beep:', error);
    return false;
  }
}

async function playDecodedBuffer() {
  const audioContext = getAudioContext();
  if (!audioContext) {
    return false;
  }

  const buffer = await decodeAlertBuffer();
  if (!buffer) {
    return false;
  }

  await unlockAudioContext();

  const source = audioContext.createBufferSource();
  const gainNode = audioContext.createGain();
  gainNode.gain.value = 0.9;
  source.buffer = buffer;
  source.connect(gainNode);
  gainNode.connect(audioContext.destination);
  source.start();

  return true;
}

export async function prepareTimeTrackerAlertSound(options = {}) {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    if (!preparedAudio) {
      preparedAudio = new Audio('/sounds/timer-alert.mp3');
      preparedAudio.preload = 'auto';
      preparedAudio.volume = 0.85;
      preparedAudio.load();
    }

    if (options.unlock) {
      await unlockAudioContext();

      if (!audioUnlocked) {
        preparedAudio.muted = true;
        preparedAudio.currentTime = 0;
        await preparedAudio.play();
        preparedAudio.pause();
        preparedAudio.currentTime = 0;
        preparedAudio.muted = false;
        audioUnlocked = true;
      }
    }

    await decodeAlertBuffer();
    return true;
  } catch (error) {
    console.error('Failed to prepare timer-alert.mp3:', error);
    try {
      preparedAudio?.pause();
      if (preparedAudio) {
        preparedAudio.currentTime = 0;
        preparedAudio.muted = false;
      }
    } catch (_resetError) {
      // Ignore reset failures.
    }
    return false;
  }
}

export async function playTimeTrackerAlertSound() {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    await prepareTimeTrackerAlertSound({ unlock: true });
    return await playDecodedBuffer();
  } catch (error) {
    console.error('Failed to play decoded timer alert, falling back to mp3 element:', error);

    try {
      if (!preparedAudio) {
        preparedAudio = new Audio('/sounds/timer-alert.mp3');
        preparedAudio.preload = 'auto';
        preparedAudio.volume = 0.85;
      }

      preparedAudio.pause();
      preparedAudio.currentTime = 0;
      preparedAudio.muted = false;
      await preparedAudio.play();
      return true;
    } catch (mp3Error) {
      console.error('Failed to play timer-alert.mp3, falling back to beep:', mp3Error);
      return playFallbackBeep();
    }
  }
}
