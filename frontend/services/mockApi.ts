// This file has been updated to connect to a real backend API.
// A mocking layer has been added to facilitate frontend development without a live backend.

import type { AnyRecord, FrfEntity } from '../types';
import * as mock_service from './mockData';

// --- API CONNECTION CONTROL ---

// STEP 1: Set this to `false` to connect to your live backend API.
// When `true`, the app uses the sample data in `services/mockData.ts`.
const USE_MOCK_API = false;

// STEP 2: Set this to the full base URL of your backend server.
// For local development, this is typically http://localhost:<PORT>/api/v1
// For a deployed application, this would be your production API URL.
const API_BASE_URL = 'https://localhost:3001/api/v1';
console.log("🔗 Connecting to real backend:", API_BASE_URL); 

// A more descriptive error message for common connection failures.
const CONNECTION_ERROR_MESSAGE = 'Network error: Could not connect to the backend API. Please ensure the backend server is running and that CORS is configured to allow requests from this origin.';

/**
 * Handles fetch responses, checks for errors, and parses JSON.
 * This function reads the response body only once to prevent "body stream already read" errors.
 * @param response The raw fetch response.
 * @returns A promise that resolves to the parsed JSON.
 * @throws An error if the network response is not ok.
 */
const handle_response = async (response: Response) => {
  // Read the body as text first. This consumes the stream once.
  const text = await response.text();

  // If there's no content, and the response is successful (e.g., 204 No Content), return an empty object.
  if (!text && response.ok) {
    return {};
  }
  
  let data;
  try {
    // Try to parse the text as JSON.
    data = JSON.parse(text);
  } catch (e) {
    // If parsing fails and the response is not OK, we can assume the raw text is the error message.
    if (!response.ok) {
      throw new Error(text || `HTTP error! status: ${response.status}`);
    }
    // If parsing fails but the response IS OK, this is unexpected. We'll log it and return the raw text.
    console.warn("API response was not valid JSON:", text);
    return text;
  }

  if (!response.ok) {
    // If the parsed data is an object with a message, use that. Otherwise, use the raw text or a default message.
    const error_message = data?.message || text || `HTTP error! status: ${response.status}`;
    throw new Error(error_message);
  }

  return data;
};

/**
 * Fetches a list of records for a given entity from the backend API.
 * @param entity_id The ID of the entity (e.g., 'students').
 * @returns A promise that resolves to an array of records.
 */
export const fetch_frf_list = async (entity_id: FrfEntity['id']): Promise<AnyRecord[]> => {
  if (USE_MOCK_API) {
    console.log(`[MOCK API] Fetching list for: ${entity_id}`);
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(mock_service.get_mock_list(entity_id));
      }, 500);
    });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/${entity_id}`);
    const data = await handle_response(response);

    // ✅ FIX: Return the array directly
    if (data && Array.isArray(data.data)) {
      return data.data;
    }

    // Handle if backend already returns array
    if (Array.isArray(data)) {
      return data;
    }

    console.warn("⚠️ Unexpected API response format:", data);
    return [];
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(CONNECTION_ERROR_MESSAGE);
    }
    throw error;
  }
};


/**
 * Fetches the detailed information for a single record from the backend API.
 * @param entity_id The ID of the entity (e.g., 'students').
 * @param record_id The ID of the record to fetch.
 * @returns A promise that resolves to the record object or null if not found.
 */
export const fetch_frf_detail = async (entity_id: FrfEntity['id'], record_id: string): Promise<AnyRecord | null> => {
   if (USE_MOCK_API) {
    console.log(`[MOCK API] Fetching detail for: ${entity_id}/${record_id}`);
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(mock_service.get_mock_detail(entity_id, record_id));
      }, 500); // Simulate network delay
    });
  }
  try {
    const response = await fetch(`${API_BASE_URL}/${entity_id}/${record_id}`);
    // A 404 Not Found is a valid case where we should return null, not throw an error.
    if (response.status === 404) {
      return null;
    }
    return await handle_response(response);
  } catch (error) {
     if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error(CONNECTION_ERROR_MESSAGE);
     }
     // If the error contains a 404 message, return null. Otherwise re-throw.
     if (error instanceof Error && error.message.includes('404')) {
        return null;
     }
     console.error(`Failed to fetch detail for ${entity_id}/${record_id}:`, error);
     throw error; // Re-throw the error to be handled by the UI component
  }
};

/**
 * Creates a new record for a given entity.
 * @param entity_id The ID of the entity (e.g., 'students').
 * @param record_data The data for the new record.
 * @returns A promise that resolves to the newly created record.
 */
export const create_frf_record = async (entity_id: FrfEntity['id'], record_data: Partial<AnyRecord>): Promise<AnyRecord> => {
    if (USE_MOCK_API) {
        console.log(`[MOCK API] Creating record for: ${entity_id}`);
        return new Promise(resolve => {
            setTimeout(() => {
                const new_record = mock_service.add_mock_record(entity_id, record_data);
                resolve(new_record);
            }, 500); // Simulate network delay
        });
    }

    try {
        const response = await fetch(`${API_BASE_URL}/${entity_id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(record_data),
        });
        return handle_response(response);
    } catch (error) {
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            throw new Error(CONNECTION_ERROR_MESSAGE);
        }
        throw error;
    }
};