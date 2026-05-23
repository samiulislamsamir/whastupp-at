import { getCachedAccessToken } from '../lib/googleAuth';

export interface SheetData {
  spreadsheetId: string;
  sheetName: string;
}

export const createSpreadsheet = async (title: string): Promise<string> => {
  const token = getCachedAccessToken();
  if (!token) throw new Error('No Google access token available');

  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: title
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create spreadsheet: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.spreadsheetId;
};

export const ensureSheetHeader = async (spreadsheetId: string, sheetName: string, headers: string[]) => {
  const token = getCachedAccessToken();
  if (!token) throw new Error('No Google access token available');

  // 1. Get spreadsheet metadata to check if the tab (sheetName) exists
  let sheetExists = false;
  try {
    const info = await getSpreadsheet(spreadsheetId);
    if (info && info.sheets) {
      sheetExists = info.sheets.some((s: any) => s.properties && s.properties.title === sheetName);
    }
  } catch (err) {
    console.error("Failed to check if worksheet tab exists. Will attempt to create it blindly if we have appropriate tokens.", err);
  }

  // 2. If it does not exist, create the tab
  if (!sheetExists) {
    try {
      console.log(`Creating worksheet tab "${sheetName}" inside spreadsheet: ${spreadsheetId}`);
      const createResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName
                }
              }
            }
          ]
        })
      });
      if (!createResponse.ok) {
        const errJson = await createResponse.json();
        console.error("Failed to create sheet/tab via API:", errJson);
      } else {
        console.log(`Successfully created sheet/tab "${sheetName}"`);
      }
    } catch (err) {
      console.error("Error creating sheet/tab:", err);
    }
  }

  // Check if header already exists
  try {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:Z1`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.values && data.values[0] && data.values[0].length > 0) {
        return; // Header exists
      }
    }
  } catch (e) {
    console.error("Error checking headers:", e);
  }

  // Write header
  await appendToSheet(spreadsheetId, `${sheetName}!A1`, [headers]);
};

export const appendToSheet = async (spreadsheetId: string, range: string, values: any[][]) => {
  const token = getCachedAccessToken();
  if (!token) throw new Error('No Google access token available');

  const response = await fetch(`/api/sheets/append`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ spreadsheetId, range, values })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to append to sheet: ${error.error?.message || response.statusText}`);
  }

  return await response.json();
};

export const getSpreadsheet = async (spreadsheetId: string) => {
  const token = getCachedAccessToken();
  if (!token) throw new Error('No Google access token available');

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to fetch spreadsheet: ${error.error?.message || response.statusText}`);
  }

  return await response.json();
};

export const syncToAppsScript = async (url: string, payload: any) => {
  const response = await fetch('/api/sheets/apps-script-sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, payload })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || response.statusText);
  }

  return await response.json();
};
