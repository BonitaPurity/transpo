const RAW_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

function getApiBaseUrl() {
  if (typeof window === 'undefined') return RAW_API_BASE_URL;
  const protocol = window.location?.protocol;
  if (protocol === 'https:' && typeof RAW_API_BASE_URL === 'string' && RAW_API_BASE_URL.startsWith('http://')) {
    return RAW_API_BASE_URL.replace(/^http:\/\//i, 'https://');
  }
  return RAW_API_BASE_URL;
}

function getStoredAuth() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('transpo_user') || 'null');
  } catch (error) {
    console.error('Failed to parse stored auth token', error);
    return null;
  }
}

function getAuthHeaders() {
  const auth = getStoredAuth();
  const headers = { 'Content-Type': 'application/json' };
  if (auth?.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }
  return headers;
}

function getFileAcceptForName(filename, fallbackMime) {
  const name = String(filename || '').toLowerCase();
  if (name.endsWith('.pdf')) {
    return { description: 'PDF', accept: { 'application/pdf': ['.pdf'] } };
  }
  if (name.endsWith('.csv')) {
    return { description: 'CSV', accept: { 'text/csv': ['.csv'] } };
  }
  if (fallbackMime) {
    return { description: 'File', accept: { [fallbackMime]: [] } };
  }
  return { description: 'File', accept: { 'application/octet-stream': [] } };
}

async function trySaveWithPicker(blob, filename, mime) {
  if (typeof window === 'undefined') return { handled: false };
  if (typeof window.showSaveFilePicker !== 'function') return { handled: false };
  if (!window.isSecureContext) return { handled: false };
  try {
    const fileType = getFileAcceptForName(filename, mime);
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [fileType],
      excludeAcceptAllOption: false,
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { handled: true };
  } catch (e) {
    if (e && (e.name === 'AbortError' || e.name === 'NotAllowedError')) {
      return { handled: true };
    }
    return { handled: false };
  }
}

async function downloadBlobFromPath(path, filename) {
  const url = `${getApiBaseUrl()}${path}`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('transpo_user');
    }
    let message = 'Download failed';
    try {
      const errJson = await res.json();
      if (errJson && errJson.message) message = errJson.message;
    } catch (e) {
      // Not JSON
    }
    throw new Error(message);
  }
  const contentType = res.headers.get('content-type') || '';
  const blob = await res.blob();
  const picked = await trySaveWithPicker(blob, filename, contentType.split(';')[0].trim());
  if (picked.handled) return;
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

/**
 * @param {string} path 
 * @param {RequestInit} options 
 */
async function request(path, options = {}, attempt = 0) {
  const url = `${getApiBaseUrl()}${path}`;
  try {
    const res = await fetch(url, {
      headers: { ...getAuthHeaders(), ...(options.headers || {}) },
      ...options,
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('transpo_user');
        }
      }
      console.warn(`API Request failed: ${res.status} ${res.statusText} for ${url}`);
    }

    const contentType = res.headers.get('content-type') || '';
    const bodyText = await res.text();

    if (!res.ok && attempt === 0 && res.status >= 500) {
      await new Promise((r) => setTimeout(r, 400));
      return request(path, options, attempt + 1);
    }

    if (contentType.includes('application/json')) {
      try {
        return JSON.parse(bodyText);
      } catch {
        console.error(`Invalid JSON from ${url}. Body starts with: ${bodyText.substring(0, 120)}...`);
        return { success: false, status: res.status, message: `Invalid JSON response from ${url}` };
      }
    }

    if (contentType.includes('text/html')) {
      console.error(`Received HTML instead of JSON from ${url}. Body starts with: ${bodyText.substring(0, 120)}...`);
      return { success: false, status: res.status, message: `Expected JSON but received HTML from ${url}` };
    }

    if (bodyText.trim().length === 0) {
      return { success: res.ok, status: res.status };
    }

    console.error(`Non-JSON response from ${url} (${res.status}). Body starts with: ${bodyText.substring(0, 120)}...`);
    return { success: false, status: res.status, message: `API unavailable or misconfigured for ${url}` };
  } catch (error) {
    console.error(`Request Error for ${url}:`, error);
    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, 400));
      return request(path, options, attempt + 1);
    }
    return { success: false, status: 0, message: error?.message || 'Request failed' };
  }
}

export const apiService = {
  /**
   * @param {object} credentials
   * @param {string} credentials.email
   * @param {string} credentials.password
   */
  async login({ email, password }) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },


  /**
   * @param {object} profile
   * @param {string} profile.name
   * @param {string} profile.email
   * @param {string} profile.phone
   * @param {string} profile.password
   */
  async register({ name, email, phone, password }) {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, phone, password }),
    });
  },

  async changePassword({ currentPassword, newPassword }) {
    return request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async adminSetUserPassword(userId, { newPassword }) {
    return request(`/admin/users/${encodeURIComponent(userId)}/password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword }),
    });
  },


  async getHubs() {
    return request('/hubs');
  },

  async getSchedules(hubId) {
    const query = hubId ? `?hubId=${encodeURIComponent(hubId)}` : '';
    return request(`/schedules${query}`);
  },

  async getDepartures({ hubId, startDate, includePast } = {}) {
    const params = new URLSearchParams();
    if (hubId) params.set('hubId', hubId);
    if (startDate) params.set('startDate', startDate);
    if (includePast) params.set('includePast', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    return request(`/departures${query}`);
  },

  async getArrivals({ hubId, startDate, destination } = {}) {
    const params = new URLSearchParams();
    if (hubId) params.set('hubId', hubId);
    if (startDate) params.set('startDate', startDate);
    if (destination) params.set('destination', destination);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request(`/arrivals${query}`);
  },

  async createBooking(bookingData) {
    return request('/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  },

  async processPayment(paymentData) {
    return request('/payments/mobile-money', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  },

  async getFleet(hubId) {
    const query = hubId ? `?hubId=${encodeURIComponent(hubId)}` : '';
    return request(`/fleet${query}`);
  },

  async getStats() {
    return request('/stats');
  },

  async getAdminUsers() {
    return request('/admin/users');
  },

  async getAdminUserDetails(userId) {
    return request(`/admin/users/${encodeURIComponent(userId)}`);
  },

  async getBookings(params = {}) {
    const q = new URLSearchParams();
    if (params.paymentStatus) q.append('paymentStatus', params.paymentStatus);
    if (params.search) q.append('search', params.search);
    const query = q.toString() ? `?${q.toString()}` : '';
    return request(`/bookings${query}`);
  },

  async getUserBookings(userId) {
    return request(`/bookings/user/${encodeURIComponent(userId)}`);
  },

  async createBus(busData) {
    return request('/fleet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(busData),
    });
  },

  async createDeparture(payload) {
    return request('/departures', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  },

  async updateDeparture(departureId, payload) {
    return request(`/departures/${encodeURIComponent(departureId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteDeparture(departureId) {
    return request(`/departures/${encodeURIComponent(departureId)}`, {
      method: 'DELETE',
    });
  },

  async trackDelivery(trackingCode) {
    return request(`/deliveries/${encodeURIComponent(trackingCode)}`);
  },

  async getMyDeliveries() {
    return request('/deliveries/mine');
  },

  async getDeliveryQuote(departureId) {
    return request(`/deliveries/quote/${encodeURIComponent(departureId)}`);
  },

  async createUserDelivery(payload) {
    return request('/deliveries', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async payDelivery({ deliveryId, phoneNumber, provider }) {
    return request('/payments/mobile-money', {
      method: 'POST',
      body: JSON.stringify({ deliveryId, phoneNumber, provider }),
    });
  },

  async getAdminDeliveries() {
    return request('/admin/deliveries');
  },

  async searchAdminDeliveries(trackingCode) {
    const query = trackingCode ? `?trackingCode=${encodeURIComponent(trackingCode)}` : '';
    return request(`/admin/deliveries${query}`);
  },

  async getAdminDeliveryDetails(trackingCode) {
    return request(`/admin/deliveries/${encodeURIComponent(trackingCode)}`);
  },

  async getAdminDeliveryContact(trackingCode) {
    return request(`/admin/deliveries/${encodeURIComponent(trackingCode)}/contact`);
  },

  async toggleAdminDeliveryReceived(trackingCode, received, options = {}) {
    const body = { received };
    if (typeof options.undo === 'boolean') body.undo = options.undo;
    return request(`/admin/deliveries/${encodeURIComponent(trackingCode)}/received`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  async getAdminDeliveryFees() {
    return request('/admin/delivery-fees');
  },

  async setAdminDeliveryFee(busId, feeAmount) {
    return request(`/admin/delivery-fees/${encodeURIComponent(busId)}`, {
      method: 'PUT',
      body: JSON.stringify({ feeAmount }),
    });
  },

  async createAdminDelivery(payload) {
    return request('/admin/deliveries', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateAdminDelivery(trackingCode, status) {
    return request(`/admin/deliveries/${encodeURIComponent(trackingCode)}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  async updateBus(busId, updates) {
    return request(`/fleet/${encodeURIComponent(busId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  },

  async getPricing() {
    return request('/pricing');
  },

  async updatePricing(id, updates) {
    return request(`/pricing/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  },

  async getBusFares() {
    return request('/admin/bus-fares');
  },

  async updateBusFare(busId, fareAmount) {
    return request(`/admin/bus-fares/${encodeURIComponent(busId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fareAmount }),
    });
  },

  async getDetailedMetrics() {
    return request('/metrics/detailed');
  },

  async getAlerts() {
    return request('/alerts');
  },

  async getBookingById(bookingId) {
    return request(`/bookings/${bookingId}`);
  },

  async exportManifest() {
    return request('/admin/manifest/export');
  },

  async downloadManifest(format = 'csv') {
    const dateKey = new Date().toISOString().split('T')[0];
    const ext = String(format).toLowerCase() === 'pdf' ? 'pdf' : 'csv';
    return downloadBlobFromPath(`/admin/manifest/export?format=${encodeURIComponent(ext)}`, `TRANSPO_AUDIT_${dateKey}.${ext}`);
  },

  async downloadAdminBookingsExport(format = 'csv', paymentStatus = 'Completed') {
    const dateKey = new Date().toISOString().split('T')[0];
    const ext = String(format).toLowerCase() === 'pdf' ? 'pdf' : 'csv';
    const ps = paymentStatus ? `&paymentStatus=${encodeURIComponent(paymentStatus)}` : '';
    return downloadBlobFromPath(`/admin/bookings/export?format=${encodeURIComponent(ext)}${ps}`, `TRANSPO_BOOKINGS_${dateKey}.${ext}`);
  },

  async downloadUserBookingsExport(userId, format = 'csv') {
    const dateKey = new Date().toISOString().split('T')[0];
    const ext = String(format).toLowerCase() === 'pdf' ? 'pdf' : 'csv';
    return downloadBlobFromPath(`/bookings/user/${encodeURIComponent(userId)}/export?format=${encodeURIComponent(ext)}`, `TRANSPO_MY_BOOKINGS_${dateKey}.${ext}`);
  },
  
  async triggerScenario(scenario, hubId) {
    return request('/admin/scenario', {
      method: 'POST',
      body: JSON.stringify({ scenario, hubId }),
    });
  },
  
  async getTelemetry(busId, limit = 60) {
    return request(`/fleet/${encodeURIComponent(busId)}/telemetry?limit=${limit}`);
  },

  async maintenanceAction(busId, action) {
    return request(`/fleet/${encodeURIComponent(busId)}/maintenance`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  },

  async getRouting(srcLat, srcLng, destLat, destLng) {
    return request(`/routing?srcLat=${srcLat}&srcLng=${srcLng}&destLat=${destLat}&destLng=${destLng}`);
  },
};
