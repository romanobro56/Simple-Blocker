// Initialize extension state
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    isBlocking: false,
    blockingEndTime: null,
    blockingDuration: null,
    blockingElapsed: 0,
    tempUnblockEndTime: null,
    tempUnblockActive: false
  });
});

// Listen for alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'endBlocking') {
    await disableBlocking();
  } else if (alarm.name === 'endTempUnblock') {
    await resumeBlocking();
  }
});

// Start blocking for specified minutes
async function startBlocking(minutes) {
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: ['blocking_rules']
  });

  const endTime = Date.now() + (minutes * 60 * 1000);

  await chrome.storage.local.set({
    isBlocking: true,
    blockingEndTime: endTime,
    blockingDuration: minutes * 60 * 1000,
    blockingElapsed: 0,
    tempUnblockActive: false,
    tempUnblockEndTime: null
  });

  // Set alarm to end blocking
  chrome.alarms.create('endBlocking', {
    when: endTime
  });
}

// Disable blocking (end of blocking session)
async function disableBlocking() {
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    disableRulesetIds: ['blocking_rules']
  });

  await chrome.storage.local.set({
    isBlocking: false,
    blockingEndTime: null,
    blockingDuration: null,
    blockingElapsed: 0,
    tempUnblockActive: false,
    tempUnblockEndTime: null
  });

  chrome.alarms.clear('endBlocking');
  chrome.alarms.clear('endTempUnblock');
}

// Temporary unblock for specified minutes (pauses blocking timer)
async function tempUnblock(minutes) {
  // Get current blocking state
  const data = await chrome.storage.local.get(['blockingEndTime', 'blockingElapsed']);

  // Calculate elapsed time
  const elapsed = data.blockingElapsed + (Date.now() - (data.blockingEndTime -
    (await chrome.storage.local.get('blockingDuration')).blockingDuration + data.blockingElapsed));

  // Disable rules temporarily
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    disableRulesetIds: ['blocking_rules']
  });

  const tempEndTime = Date.now() + (minutes * 60 * 1000);

  await chrome.storage.local.set({
    tempUnblockActive: true,
    tempUnblockEndTime: tempEndTime,
    blockingElapsed: elapsed
  });

  // Clear the main blocking alarm
  chrome.alarms.clear('endBlocking');

  // Set alarm to resume blocking
  chrome.alarms.create('endTempUnblock', {
    when: tempEndTime
  });
}

// Resume blocking after temporary unblock
async function resumeBlocking() {
  const data = await chrome.storage.local.get(['blockingDuration', 'blockingElapsed']);

  // Re-enable blocking rules
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: ['blocking_rules']
  });

  // Calculate remaining time
  const remainingTime = data.blockingDuration - data.blockingElapsed;
  const newEndTime = Date.now() + remainingTime;

  await chrome.storage.local.set({
    tempUnblockActive: false,
    tempUnblockEndTime: null,
    blockingEndTime: newEndTime
  });

  // Set alarm for remaining blocking time
  chrome.alarms.create('endBlocking', {
    when: newEndTime
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startBlocking') {
    startBlocking(message.minutes).then(() => {
      sendResponse({ success: true });
    });
    return true;
  } else if (message.action === 'tempUnblock') {
    tempUnblock(message.minutes).then(() => {
      sendResponse({ success: true });
    });
    return true;
  } else if (message.action === 'getStatus') {
    chrome.storage.local.get([
      'isBlocking',
      'blockingEndTime',
      'blockingDuration',
      'blockingElapsed',
      'tempUnblockActive',
      'tempUnblockEndTime'
    ], (result) => {
      sendResponse(result);
    });
    return true;
  }
});
