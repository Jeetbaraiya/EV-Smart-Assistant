/**
 * India Charging Stations Service
 * 
 * This service can be extended to integrate with real APIs:
 * - Statiq API
 * - PlugKart API
 * - Tata Power API
 * - Ather Grid API
 * - ChargeZone API
 * - EESL API
 * etc.
 */

const axios = require('axios');

class IndiaStationsService {
  constructor() {
    // API keys would be stored in environment variables
    this.statiqApiKey = process.env.STATIQ_API_KEY;
    this.plugkartApiKey = process.env.PLUGKART_API_KEY;
    // Add other API keys as needed
  }

  /**
   * Fetch stations from Statiq API
   * Requires API key and registration
   */
  async fetchFromStatiq(city, state) {
    if (!this.statiqApiKey) {
      throw new Error('Statiq API key not configured');
    }

    try {
      // Example API call (adjust based on actual Statiq API documentation)
      const response = await axios.get('https://api.statiq.in/v1/stations', {
        headers: {
          'Authorization': `Bearer ${this.statiqApiKey}`,
          'Content-Type': 'application/json'
        },
        params: {
          city,
          state,
          status: 'active'
        }
      });

      return this.transformStatiqData(response.data);
    } catch (error) {
      console.error('Error fetching from Statiq API:', error);
      throw error;
    }
  }

  /**
   * Fetch stations from PlugKart API
   */
  async fetchFromPlugKart(location) {
    if (!this.plugkartApiKey) {
      throw new Error('PlugKart API key not configured');
    }

    try {
      const response = await axios.get('https://api.plugkart.energy/v1/stations', {
        headers: {
          'X-API-Key': this.plugkartApiKey,
          'Content-Type': 'application/json'
        },
        params: {
          location,
          available: true
        }
      });

      return this.transformPlugKartData(response.data);
    } catch (error) {
      console.error('Error fetching from PlugKart API:', error);
      throw error;
    }
  }

  /**
   * Transform Statiq API response to our format
   */
  transformStatiqData(data) {
    // Transform based on Statiq API response structure
    return data.stations?.map(station => ({
      id: `statiq_${station.id}`,
      name: station.name,
      address: station.address,
      city: station.city,
      state: station.state,
      zip_code: station.pincode,
      latitude: station.latitude,
      longitude: station.longitude,
      connector_type: station.connector_type || 'CCS2',
      power_kw: station.power_rating || 50,
      availability: station.status === 'available' ? 'available' : 'unavailable',
      source: 'india_api',
      network: 'Statiq',
      raw_data: station
    })) || [];
  }

  /**
   * Transform PlugKart API response to our format
   */
  transformPlugKartData(data) {
    // Transform based on PlugKart API response structure
    return data.stations?.map(station => ({
      id: `plugkart_${station.id}`,
      name: station.station_name,
      address: station.address,
      city: station.city,
      state: station.state,
      zip_code: station.pincode,
      latitude: station.lat,
      longitude: station.lng,
      connector_type: station.connector_type || 'Type 2',
      power_kw: station.power || 30,
      availability: station.is_available ? 'available' : 'unavailable',
      source: 'india_api',
      network: 'PlugKart',
      raw_data: station
    })) || [];
  }

  /**
   * Aggregate stations from multiple sources
   */
  async fetchAllStations(filters = {}) {
    const allStations = [];

    try {
      // Fetch from Statiq if API key is available
      if (this.statiqApiKey) {
        const statiqStations = await this.fetchFromStatiq(filters.city, filters.state);
        allStations.push(...statiqStations);
      }
    } catch (error) {
      console.error('Failed to fetch from Statiq:', error.message);
    }

    try {
      // Fetch from PlugKart if API key is available
      if (this.plugkartApiKey) {
        const plugkartStations = await this.fetchFromPlugKart(filters.location);
        allStations.push(...plugkartStations);
      }
    } catch (error) {
      console.error('Failed to fetch from PlugKart:', error.message);
    }

    // Remove duplicates based on location
    const uniqueStations = this.removeDuplicates(allStations);

    return uniqueStations;
  }

  /**
   * Remove duplicate stations based on location proximity
   */
  removeDuplicates(stations) {
    const seen = new Set();
    return stations.filter(station => {
      const key = `${station.latitude?.toFixed(4)}_${station.longitude?.toFixed(4)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}

module.exports = new IndiaStationsService();

