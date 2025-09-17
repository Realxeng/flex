export async function putKeyValue(env, key, value) {
  await env.reminderList.put(key, JSON.stringify(value));
}

export async function getTrackingList(env) {
  //Get the CIDs
  const trackingListRaw = await env.reminderList.get('track')
  //check if the list has value
  if (!trackingListRaw) {
    // Return empty array if no value
    return [];
  }

  try {
    const trackingList = JSON.parse(trackingListRaw);
    // Ensure it’s always an array
    return Array.isArray(trackingList) ? trackingList : [trackingList];
  } catch (err) {
    console.error('Could not parse reminderFinish:', err);
    return [];
  }
}